import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthConfig } from '../src/auth/auth.config';
import { DbConfig } from '../src/db/db.config';
import { DeviceConfig } from '../src/device/device.config';
import { EntriesService } from '../src/entries/application/entries.service';

/**
 * HTTP through the real module — routing, ValidationPipe, DTOs, key guard and rate limit
 * as in production. Only the service and the configs are replaced, so no database,
 * no device and no environment variables are needed.
 */
const READER = { 'x-api-key': 'reader-key-0123456789' };
const STAFF = { 'x-api-key': 'staff-key-0123456789' };

async function startApp(service: object, rateLimit?: number): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EntriesService)
    .useValue(service)
    .overrideProvider(AuthConfig)
    .useValue(new AuthConfig(READER['x-api-key'], STAFF['x-api-key']))
    .overrideProvider(DbConfig)
    .useValue(new DbConfig('127.0.0.1', 3307, 'gym', 'unused', 'gym'))
    .overrideProvider(DeviceConfig)
    .useValue(new DeviceConfig('http://device.test/open', 'device-token-0123456789', 700, 3, 100, 5, 10_000));
  if (rateLimit === undefined) {
    // Most tests send many requests in a row; the limit gets its own test below.
    builder = builder.overrideProvider(getOptionsToken()).useValue({ throttlers: [{ ttl: 1000, limit: 10_000 }] });
  }
  const app = (await builder.compile()).createNestApplication();
  await app.init();
  return app;
}

describe('HTTP /entries', () => {
  let app: INestApplication;
  const service = { enter: jest.fn().mockResolvedValue({ status: 'opened' }), last: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    app = await startApp(service);
  });
  afterAll(() => app.close());
  afterEach(() => jest.clearAllMocks());

  describe('who may call what', () => {
    it.each([
      [
        'POST /entries without a key',
        () => request(app.getHttpServer()).post('/entries').send({ cardCode: 'CARD-001' }),
      ],
      [
        'POST /entries with the staff key',
        () => request(app.getHttpServer()).post('/entries').set(STAFF).send({ cardCode: 'CARD-001' }),
      ],
      [
        'POST /entries with a wrong key',
        () =>
          request(app.getHttpServer()).post('/entries').set({ 'x-api-key': 'guess' }).send({ cardCode: 'CARD-001' }),
      ],
      ['GET /entries without a key', () => request(app.getHttpServer()).get('/entries')],
      ['GET /entries with the reader key', () => request(app.getHttpServer()).get('/entries').set(READER)],
    ])('%s → 401, service not called', async (_name, send) => {
      await send().expect(401);
      expect(service.enter).not.toHaveBeenCalled();
      expect(service.last).not.toHaveBeenCalled();
    });

    it('GET /health needs no key', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ ok: true, breakerOpen: false, deviceFailures: 0 });
    });
  });

  describe('POST /entries input', () => {
    it.each([
      [{ cardCode: 123 }],
      [{ cardCode: null }],
      [{ cardCode: {} }],
      [{ cardCode: '   ' }],
      [{}],
      [{ cardCode: 'X'.repeat(33) }], // longer than the DB column
      [{ cardCode: '<img src=x onerror=alert(1)>' }], // would be stored and shown to the front desk
      [{ cardCode: 'card-001' }], // lower case — the DB collation would match it to CARD-001
      [{ cardCode: 'CARD-001', isAdmin: true }], // a field the DTO does not declare
    ])('%j → 400, service not called', async (body) => {
      await request(app.getHttpServer()).post('/entries').set(READER).send(body).expect(400);
      expect(service.enter).not.toHaveBeenCalled();
    });

    it('passes a trimmed card code to the service', async () => {
      await request(app.getHttpServer()).post('/entries').set(READER).send({ cardCode: ' CARD-001 ' }).expect(200);
      expect(service.enter).toHaveBeenCalledWith('CARD-001');
    });
  });

  describe('GET /entries?limit', () => {
    it.each([
      ['', 20],
      ['?limit=5', 5],
      ['?limit=100', 100],
    ])('GET /entries%s → limit %p', async (qs, expected) => {
      await request(app.getHttpServer()).get(`/entries${qs}`).set(STAFF).expect(200);
      expect(service.last).toHaveBeenCalledWith(expected);
    });

    it.each([['-5'], ['0'], ['2.5'], ['abc'], ['500']])('limit=%s → 400, service not called', async (limit) => {
      await request(app.getHttpServer()).get(`/entries?limit=${limit}`).set(STAFF).expect(400);
      expect(service.last).not.toHaveBeenCalled();
    });
  });
});

describe('HTTP rate limit', () => {
  it('answers 429 to the 11th pass within one second from the same client', async () => {
    const service = { enter: jest.fn().mockResolvedValue({ status: 'denied_unknown' }) };
    const app = await startApp(service, 10);
    const send = () => request(app.getHttpServer()).post('/entries').set(READER).send({ cardCode: 'CARD-999' });
    try {
      for (let i = 0; i < 10; i++) await send().expect(200);
      await send().expect(429);
      expect(service.enter).toHaveBeenCalledTimes(10);
    } finally {
      await app.close();
    }
  });
});
