import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import mysql from 'mysql2/promise';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthConfig } from '../../src/auth/auth.config';
import { configureApp } from '../../src/configure-app';
import { DbConfig } from '../../src/db/db.config';
import { DeviceConfig } from '../../src/device/device.config';
import { DeviceMode, FakeDevice, startFakeDevice } from '../../src/fake-device';
import { appDbConfig, resetData, rootPool } from './test-db';

/**
 * The whole service with nothing replaced: real MySQL, real HTTP client, the fake turnstile
 * in each of its modes. DEVICE_MODE is the positive control — every failure is produced on demand.
 */
const READER = { 'x-api-key': 'reader-key-0123456789' };
const TOKEN = 'device-token-0123456789';

async function startStack(device: FakeDevice, db: DbConfig = appDbConfig()): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AuthConfig)
    .useValue(new AuthConfig(READER['x-api-key'], 'staff-key-0123456789'))
    .overrideProvider(DbConfig)
    .useValue(db)
    // timeout 100 ms, 3 attempts, backoff 10 ms, breaker after 3 failures
    .overrideProvider(DeviceConfig)
    .useValue(new DeviceConfig(device.url, TOKEN, 100, 3, 10, 3, 60_000))
    .overrideProvider(getOptionsToken())
    .useValue({ throttlers: [{ ttl: 1000, limit: 10_000 }] })
    .compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
  await app.init();
  return app;
}

describe('the whole stack', () => {
  const root = rootPool();
  let device: FakeDevice;
  let app: INestApplication;

  const pass = (cardCode = 'CARD-001') => request(app.getHttpServer()).post('/entries').set(READER).send({ cardCode });
  const rows = async () =>
    (await root.query<mysql.RowDataPacket[]>('SELECT card_code, status, detail FROM entries ORDER BY id'))[0];

  async function withDevice(mode: DeviceMode) {
    device = await startFakeDevice({ mode, token: TOKEN, delayMs: 500 });
    app = await startStack(device);
  }

  beforeEach(() => resetData(root));
  afterEach(async () => {
    await app?.close();
    await device?.close();
  });
  afterAll(() => root.end());

  it('ok: opens on the first attempt and records it', async () => {
    await withDevice('ok');
    await pass()
      .expect(200)
      .expect((r) => expect(r.body).toMatchObject({ status: 'opened' }));
    expect(device.calls()).toBe(1);
    expect(await rows()).toEqual([expect.objectContaining({ card_code: 'CARD-001', status: 'opened' })]);
  });

  it('flaky: opens on the second attempt', async () => {
    await withDevice('flaky');
    await pass().expect((r) => expect(r.body).toMatchObject({ status: 'opened' }));
    expect(device.calls()).toBe(2);
    expect(await rows()).toEqual([expect.objectContaining({ detail: 'otevřeno na 2. pokus' })]);
  });

  it('fail: tries three times, answers device_failed and STILL records it', async () => {
    await withDevice('fail');
    await pass().expect((r) => expect(r.body).toMatchObject({ status: 'device_failed' }));
    expect(device.calls()).toBe(3);
    expect(await rows()).toEqual([
      expect.objectContaining({ status: 'device_failed', detail: expect.stringContaining('http_500') }),
    ]);
  });

  it('slow: times out instead of waiting, and records "timeout"', async () => {
    await withDevice('slow');
    const t0 = Date.now();
    await pass().expect((r) => expect(r.body).toMatchObject({ status: 'device_failed' }));
    expect(Date.now() - t0).toBeLessThan(500); // 3 × 100 ms timeout + backoff, far below the device's 500 ms
    expect(await rows()).toEqual([expect.objectContaining({ detail: expect.stringContaining('timeout') })]);
  });

  it('breaker: after three failed passes the device is not called at all', async () => {
    await withDevice('fail');
    for (let i = 0; i < 3; i++) await pass();
    const before = device.calls();
    await pass().expect((r) => expect(r.body.detail).toContain('breaker_open'));
    expect(device.calls()).toBe(before);
    expect(await rows()).toHaveLength(4); // the refused pass is recorded too
  });

  it('wrong device token: the turnstile refuses, the pass ends as device_failed', async () => {
    device = await startFakeDevice({ mode: 'ok', token: 'some-other-token-0000' });
    app = await startStack(device);
    await pass().expect((r) => expect(r.body).toMatchObject({ status: 'device_failed' }));
    expect(device.calls()).toBe(0);
  });

  it('expired and unknown cards never reach the device, and both are recorded', async () => {
    await withDevice('ok');
    await pass('CARD-002').expect((r) => expect(r.body).toMatchObject({ status: 'denied_expired' }));
    await pass('NOPE-1').expect((r) => expect(r.body).toMatchObject({ status: 'denied_unknown' }));
    expect(device.calls()).toBe(0);
    expect((await rows()).map((r) => r.status)).toEqual(['denied_expired', 'denied_unknown']);
  });

  it('30 passes at once with a pool of 5 connections: all answered, all recorded', async () => {
    await withDevice('ok');
    const results = await Promise.all(Array.from({ length: 30 }, () => pass()));
    expect(results.map((r) => r.body.status)).toEqual(Array(30).fill('opened'));
    expect(await rows()).toHaveLength(30);
  });

  it('readiness: 200 with the database, 503 without it', async () => {
    await withDevice('ok');
    await request(app.getHttpServer()).get('/health/ready').expect(200);
    await app.close();

    app = await startStack(device, new DbConfig('127.0.0.1', 1, 'gym', 'x', 'gym')); // nothing listens on port 1
    await request(app.getHttpServer()).get('/health/ready').expect(503);
  });

  it('sends security headers and refuses an oversized body', async () => {
    await withDevice('ok');
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    await request(app.getHttpServer())
      .post('/entries')
      .set(READER)
      .send({ cardCode: 'A'.repeat(2000) })
      .expect(413);
  });
});
