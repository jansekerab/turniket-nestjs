import { Module } from '@nestjs/common';
import { DbConfig } from './db.config';
import { DbService } from './db.service';

@Module({
  providers: [{ provide: DbConfig, useFactory: () => DbConfig.fromEnv() }, DbService],
  exports: [DbService],
})
export class DbModule {}
