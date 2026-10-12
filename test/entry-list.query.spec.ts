import { DbService } from '../src/db/db.service';
import { MysqlEntryListQuery, maskCardCode } from '../src/entries/infrastructure/mysql-entry-list.query';

/** The listing maps DB columns to camelCase and never returns a whole card code. */
describe('MysqlEntryListQuery', () => {
  it('maps a snake_case row to the camelCase listing, with the card code masked', async () => {
    const db = {
      query: jest.fn().mockResolvedValue([
        {
          id: 7,
          card_code: 'CARD-001',
          full_name: 'Jan Platný',
          status: 'opened',
          detail: 'otevřeno na 1. pokus',
          device_ms: 29,
          created_at: '2026-10-01 06:58:48',
        },
      ]),
    };
    const list = await new MysqlEntryListQuery(db as unknown as DbService).latest(5);

    expect(list).toEqual([
      {
        id: 7,
        cardCodeMasked: '*****001',
        fullName: 'Jan Platný',
        status: 'opened',
        detail: 'otevřeno na 1. pokus',
        deviceMs: 29,
        createdAt: '2026-10-01 06:58:48',
      },
    ]);
    expect(db.query.mock.calls[0][1]).toEqual([5]);
  });

  it.each([
    ['CARD-001', '*****001'],
    ['AB', 'AB'],
  ])('masks %p as %p', (code, masked) => {
    expect(maskCardCode(code)).toBe(masked);
  });
});
