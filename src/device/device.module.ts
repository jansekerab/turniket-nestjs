import { Module } from '@nestjs/common';
import { Turnstile } from '../entries/domain/turnstile';
import { DeviceClient } from './device.client';
import { DeviceConfig } from './device.config';

/** The turnstile adapter. Outside this module it is known only as the domain's Turnstile. */
@Module({
  providers: [
    { provide: DeviceConfig, useFactory: () => DeviceConfig.fromEnv() },
    DeviceClient,
    { provide: Turnstile, useExisting: DeviceClient },
  ],
  exports: [Turnstile, DeviceClient],
})
export class DeviceModule {}
