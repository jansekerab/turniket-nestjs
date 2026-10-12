import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/api-key.guard';
import { DbService } from '../db/db.service';
import { DeviceClient } from '../device/device.client';

/** Operational probes. Open without a key — they reveal no personal data. */
@ApiTags('provoz')
@Controller('health')
export class HealthController {
  constructor(
    private readonly device: DeviceClient,
    private readonly db: DbService,
  ) {}

  /** Liveness: the process answers. Shows the breaker so operations see a failing turnstile. */
  @Get()
  @Public('liveness probe for the orchestrator, no personal data')
  @ApiOperation({ summary: 'Žije proces? Ukáže i stav pojistky zařízení.' })
  health() {
    return {
      ok: true,
      breakerOpen: this.device.isBreakerOpen(),
      deviceFailures: this.device.failures,
    };
  }

  /** Readiness: the service can do its job — without the database no pass can be decided. */
  @Get('ready')
  @Public('readiness probe for the orchestrator, no personal data')
  @ApiOperation({ summary: 'Zvládne služba svou práci? Bez databáze ne.' })
  @ApiOkResponse({ description: 'Databáze odpovídá.' })
  @ApiServiceUnavailableResponse({ description: 'Databáze nedostupná.' })
  async ready() {
    if (!(await this.db.ping())) throw new ServiceUnavailableException('databáze nedostupná');
    return { ok: true };
  }
}
