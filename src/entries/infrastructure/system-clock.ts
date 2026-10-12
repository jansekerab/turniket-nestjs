import { Clock } from '../domain/clock';

/**
 * The gym's calendar day, not the server's: in Docker the server runs in UTC, and
 * between 00:00 and 02:00 Prague time UTC is still on yesterday.
 * 'sv-SE' happens to format the date as YYYY-MM-DD.
 */
export class SystemClock extends Clock {
  constructor(private readonly timeZone: string) {
    super();
    // Fail at startup on a misspelled zone, not with a 500 on every pass.
    try {
      this.today();
    } catch {
      throw new Error(`neplatná časová zóna: "${timeZone}"`);
    }
  }

  today(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: this.timeZone });
  }
}
