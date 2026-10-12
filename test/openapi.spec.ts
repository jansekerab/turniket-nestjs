import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthConfig } from '../src/auth/auth.config';
import { configureApp } from '../src/configure-app';
import { DbConfig } from '../src/db/db.config';
import { DeviceConfig } from '../src/device/device.config';
import { ENTRY_STATUSES } from '../src/entries/domain/entry.entity';
import { CARD_CODE_PATTERN } from '../src/entries/ui/entries.dto';
import { buildOpenApi, serveDocs } from '../src/openapi';

/**
 * The API documentation is generated from the code — these tests check that it says
 * what the code does: every route, who may call it, the card format, the statuses.
 */
describe('API documentation (OpenAPI)', () => {
  let app: INestApplication;
  let doc: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthConfig)
      .useValue(new AuthConfig('reader-key-0123456789', 'staff-key-0123456789'))
      .overrideProvider(DbConfig)
      .useValue(new DbConfig('127.0.0.1', 3307, 'gym', 'unused', 'gym'))
      .overrideProvider(DeviceConfig)
      .useValue(new DeviceConfig('http://device.test/open', 'device-token-0123456789', 700, 3, 100, 5, 10_000))
      .compile();
    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
    serveDocs(app);
    await app.init();
    doc = buildOpenApi(app);
  });
  afterAll(() => app.close());

  it('documents every route', () => {
    expect(Object.keys(doc.paths).sort()).toEqual(['/entries', '/health', '/health/ready']);
    expect(Object.keys(doc.paths['/entries']).sort()).toEqual(['get', 'post']);
  });

  it('marks the key on protected routes and only there', () => {
    expect(doc.paths['/entries'].post?.security).toEqual([{ 'api-key': [] }]);
    expect(doc.paths['/entries'].get?.security).toEqual([{ 'api-key': [] }]);
    expect(doc.paths['/health'].get?.security).toBeUndefined();
    expect(doc.paths['/health/ready'].get?.security).toBeUndefined();
  });

  it('describes limit as a whole number 1–100, and no field as an empty object', () => {
    const limit = doc.paths['/entries'].get?.parameters?.find((x) => 'name' in x && x.name === 'limit') as {
      schema: { type?: string; minimum?: number; maximum?: number };
    };
    expect(limit.schema).toMatchObject({ type: 'integer', minimum: 1, maximum: 100 });
    expect(Object.keys(doc.components?.schemas ?? {})).not.toContain('Object');
  });

  it('shows the same card format the validation enforces', () => {
    const schema = doc.components?.schemas?.EnterDto as { properties: Record<string, { pattern?: string }> };
    expect(schema.properties.cardCode.pattern).toBe(CARD_CODE_PATTERN.source);
  });

  it('lists exactly the statuses the domain has', () => {
    const schema = doc.components?.schemas?.EntryOutcomeResponse as { properties: Record<string, { enum?: string[] }> };
    expect(schema.properties.status.enum).toEqual([...ENTRY_STATUSES]);
  });

  it('serves the UI and the JSON, with the security headers still on', async () => {
    const ui = await request(app.getHttpServer()).get('/docs').expect(200);
    expect(ui.headers['x-content-type-options']).toBe('nosniff');
    await request(app.getHttpServer()).get('/docs-json').expect(200);
  });
});
