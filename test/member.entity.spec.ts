import { Member } from '../src/entries/domain/member.entity';

/**
 * Test last day of membership. The Member class is a domain object — it knows nothing
 * about SQL or HTTP. It is tested in isolation, without any database or network.
 */
describe('Member.hasExpiredOn', () => {
  const member = new Member(1, 'CARD-003', 'Jana Nováková', '2026-09-30');

  test('předposlední den členství ještě platí', () => {
    expect(member.hasExpiredOn('2026-09-29')).toBe(false);
  });

  test('poslední den členství ještě platí', () => {
    expect(member.hasExpiredOn('2026-09-30')).toBe(false);
  });

  test('den po uplynutí členství již neplatí', () => {
    expect(member.hasExpiredOn('2026-10-01')).toBe(true);
  });
});
