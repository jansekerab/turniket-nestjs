import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { DeviceModule } from '../device/device.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DbModule, DeviceModule],
  controllers: [HealthController],
})
export class HealthModule {}
