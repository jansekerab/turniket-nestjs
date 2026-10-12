import { Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2/promise';
import { DbService } from '../../db/db.service';
import { Member } from '../domain/member.entity';
import { MemberRepository } from '../domain/member.repository';

interface MemberRow extends RowDataPacket {
  id: number;
  card_code: string;
  full_name: string;
  valid_until: string; // 'YYYY-MM-DD' — see dateStrings in DbService
}

/**
 * All SQL about members lives here. The service above gets entities, never rows,
 * so swapping MySQL for something else touches this file only.
 */
@Injectable()
export class MysqlMemberRepository extends MemberRepository {
  constructor(private readonly db: DbService) {
    super();
  }

  async findByCardCode(cardCode: string): Promise<Member | null> {
    const [r] = await this.db.query<MemberRow>(
      'SELECT id, card_code, full_name, valid_until FROM members WHERE card_code = ? LIMIT 1',
      [cardCode],
    );
    return r ? new Member(r.id, r.card_code, r.full_name, r.valid_until) : null;
  }
}
