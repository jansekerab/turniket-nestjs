/**
 * A gym member. A domain object — it knows nothing about SQL or HTTP.
 *
 * validUntil is a plain 'YYYY-MM-DD' string on purpose: it is a calendar date,
 * not an instant, so it has no time and no zone. Turning it into a Date and
 * converting that to UTC would shift it by a day.
 */
export class Member {
  constructor(
    readonly id: number,
    readonly cardCode: string,
    readonly fullName: string,
    readonly validUntil: string,
  ) {}

  /**
   * Has the membership expired on the given day?
   * Both sides are 'YYYY-MM-DD', so lexicographic order equals chronological order.
   */
  hasExpiredOn(today: string): boolean {
    return this.validUntil < today;
  }
}
