import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { Entry } from '../domain/entry.entity';
import { EntryRepository } from '../domain/entry.repository';

/** All SQL that writes pass records lives here. */
@Injectable()
export class MysqlEntryRepository extends EntryRepository {
  constructor(private readonly db: DbService) {
    super();
  }

  async record(entry: Entry): Promise<void> {
    await this.db.exec('INSERT INTO entries (member_id, card_code, status, detail, device_ms) VALUES (?, ?, ?, ?, ?)', [
      entry.memberId,
      entry.cardCode,
      entry.status,
      entry.detail,
      entry.deviceMs,
    ]);
  }
}
