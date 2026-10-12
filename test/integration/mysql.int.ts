import mysql from 'mysql2/promise';
import { DbService } from '../../src/db/db.service';
import { ENTRY_STATUSES, Entry } from '../../src/entries/domain/entry.entity';
import { MysqlEntryListQuery } from '../../src/entries/infrastructure/mysql-entry-list.query';
import { MysqlEntryRepository } from '../../src/entries/infrastructure/mysql-entry.repository';
import { MysqlMemberRepository } from '../../src/entries/infrastructure/mysql-member.repository';
import { appDbConfig, resetData, rootPool, TEST_DB_PORT } from './test-db';

/** The SQL side against a real MySQL with the production schema and the production user rights. */
describe('MySQL (schema, rights, repositories)', () => {
  const root = rootPool();
  const db = new DbService(appDbConfig());

  beforeEach(() => resetData(root));
  afterAll(async () => {
    await db.onModuleDestroy();
    await root.end();
  });

  it('finds a member with the name and date intact (utf8mb4, DATE as a string)', async () => {
    const m = await new MysqlMemberRepository(db).findByCardCode('CARD-001');
    expect(m).toMatchObject({ id: 1, fullName: 'Jan Platný', validUntil: '2099-12-31' });
  });

  it('matches card codes exactly — "card-001" is not "CARD-001" (collation _bin)', async () => {
    await expect(new MysqlMemberRepository(db).findByCardCode('card-001')).resolves.toBeNull();
  });

  it('writes a record and lists it masked, unknown cards included (LEFT JOIN)', async () => {
    const repo = new MysqlEntryRepository(db);
    await repo.record(new Entry(1, 'CARD-001', 'opened', 'otevřeno na 1. pokus', 12));
    await repo.record(new Entry(null, 'NOPE-9', 'denied_unknown', 'karta není v evidenci', null));

    const list = await new MysqlEntryListQuery(db).latest(10);
    expect(list).toEqual([
      expect.objectContaining({ cardCodeMasked: '***E-9', fullName: null, status: 'denied_unknown' }),
      expect.objectContaining({ cardCodeMasked: '*****001', fullName: 'Jan Platný', status: 'opened', deviceMs: 12 }),
    ]);
  });

  it('has the same statuses in the ENUM as the code (no drift between schema and TypeScript)', async () => {
    const [[col]] = await root.query<mysql.RowDataPacket[]>(
      "SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='gym' AND TABLE_NAME='entries' AND COLUMN_NAME='status'",
    );
    const inDb = [...String(col.t).matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(inDb.sort()).toEqual([...ENTRY_STATUSES].sort());
  });

  it.each([
    ["UPDATE members SET valid_until = '2100-01-01'"],
    ['DELETE FROM entries'],
    ["INSERT INTO members (card_code, full_name, valid_until) VALUES ('X-1', 'X', '2100-01-01')"],
    ['DROP TABLE entries'],
  ])('the application user may not: %s', async (sql) => {
    const conn = await mysql.createConnection({ ...appDbConfig(), port: TEST_DB_PORT });
    try {
      await expect(conn.query(sql)).rejects.toThrow(/denied/);
    } finally {
      await conn.end();
    }
  });
});
