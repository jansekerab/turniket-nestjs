import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { DeviceModule } from '../device/device.module';
import { EntriesService } from './application/entries.service';
import { EntryListQuery } from './application/entry-list.query';
import { Clock } from './domain/clock';
import { EntryRepository } from './domain/entry.repository';
import { MemberRepository } from './domain/member.repository';
import { MysqlEntryListQuery } from './infrastructure/mysql-entry-list.query';
import { MysqlEntryRepository } from './infrastructure/mysql-entry.repository';
import { MysqlMemberRepository } from './infrastructure/mysql-member.repository';
import { SystemClock } from './infrastructure/system-clock';
import { EntriesController } from './ui/entries.controller';

/** The one place that decides which implementation stands behind each abstraction. */
@Module({
  imports: [DbModule, DeviceModule],
  controllers: [EntriesController],
  providers: [
    EntriesService,
    { provide: MemberRepository, useClass: MysqlMemberRepository },
    { provide: EntryRepository, useClass: MysqlEntryRepository },
    { provide: EntryListQuery, useClass: MysqlEntryListQuery },
    { provide: Clock, useFactory: () => new SystemClock(process.env.GYM_TIME_ZONE ?? 'Europe/Prague') },
  ],
})
export class EntriesModule {}
