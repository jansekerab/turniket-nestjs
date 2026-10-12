import { Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2/promise';
import { DbService } from '../../db/db.service';
import { EntryListItem, EntryListQuery } from '../application/entry-list.query';
import { EntryStatus } from '../domain/entry.entity';

interface EntryListRow extends RowDataPacket {
  id: number;
  card_code: string;
  full_name: string | null;
  status: EntryStatus;
  detail: string | null;
  device_ms: number | null;
  created_at: string;
}

/** 'CARD-001' → '*****001'. Enough for the front desk to tell cards apart, not enough to open the gate. */
export const maskCardCode = (code: string): string => '*'.repeat(Math.max(code.length - 3, 0)) + code.slice(-3);

/** The front-desk listing. Column names stay here — callers get camelCase. */
@Injectable()
export class MysqlEntryListQuery extends EntryListQuery {
  constructor(private readonly db: DbService) {
    super();
  }

  /**
   * LEFT JOIN, not a plain JOIN: an unknown card has no member row, and a plain JOIN
   * would drop that record — yet it is exactly the one the front desk wants to see most.
   */
  async latest(limit: number): Promise<EntryListItem[]> {
    const rows = await this.db.query<EntryListRow>(
      `SELECT e.id, e.card_code, m.full_name, e.status, e.detail, e.device_ms, e.created_at
         FROM entries e
         LEFT JOIN members m ON m.id = e.member_id
        ORDER BY e.id DESC
        LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      cardCodeMasked: maskCardCode(r.card_code),
      fullName: r.full_name,
      status: r.status,
      detail: r.detail,
      deviceMs: r.device_ms,
      createdAt: r.created_at,
    }));
  }
}
