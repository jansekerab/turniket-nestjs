import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * API documentation generated from the same decorators that validate the input (DTOs) —
 * one source, so the documentation cannot drift from what the service actually accepts.
 */
export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Turniket')
    .setDescription(
      'Průchod turniketem: ověření karty, otevření zařízení, zápis každého pokusu. ' +
        'Klíč v hlavičce x-api-key: čtečka smí jen POST /entries, recepce jen GET /entries.',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .build();
  return SwaggerModule.createDocument(app, config);
}

/** Swagger UI on /docs and the JSON on /docs-json. Off in production (main.ts decides). */
export function serveDocs(app: INestApplication): void {
  SwaggerModule.setup('docs', app, buildOpenApi(app));
}
