import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { serveDocs } from './openapi';

async function bootstrap() {
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule));
  // The API description is for developers; in production it only maps the attack surface.
  if (process.env.NODE_ENV !== 'production') serveDocs(app);
  const port = Number(process.env.PORT ?? 3005);
  await app.listen(port);
  new Logger('Bootstrap').log(`turniket běží na http://localhost:${port}`);
}
void bootstrap();
