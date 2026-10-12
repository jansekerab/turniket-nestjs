import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/**
 * HTTP settings shared by main.ts and the tests — so the tests run with the same
 * headers and body limit as production, not a lighter copy.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  // Security headers (no X-Powered-By, nosniff, frame-ancestors…). The API serves JSON only.
  app.use(helmet());
  // A pass is one short JSON field. The default 100 kB limit is far more than any reader sends.
  app.useBodyParser('json', { limit: '1kb' });
  // On SIGTERM run onModuleDestroy hooks — DbService closes the connection pool.
  app.enableShutdownHooks();
  return app;
}
