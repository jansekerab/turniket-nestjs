/**
 * Load test against the RUNNING service (npm start + npm run device): npm run load
 * A turnstile must open within a moment even when the whole gym arrives at 6 pm.
 * Fails (exit 1) when p95 of a pass exceeds the budget or any request errors.
 *
 * Each connection gets its own X-Forwarded-For is NOT used — the rate limit is per client IP,
 * so the test runs below it on purpose (connections × rate ≤ limit) and measures latency, not the limiter.
 */
import autocannon from 'autocannon';

const url = process.env.LOAD_URL ?? 'http://127.0.0.1:3005/entries';
const p95BudgetMs = Number(process.env.LOAD_P95_MS ?? 150);
const key = process.env.READER_API_KEY;
if (!key) throw new Error('READER_API_KEY chybí — spouštěj přes npm run load (načte .env)');

void autocannon(
  {
    url,
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ cardCode: 'CARD-001' }),
    connections: 2,
    overallRate: 5, // requests per second in total — well under the 10/s limit per client (8/s hit 429 in a sliding window)
    duration: 10,
  },
  (err, r) => {
    if (err) throw err;
    const p95 = r.latency.p97_5 ?? r.latency.p99; // autocannon reports p97.5 / p99; take p97.5 as the upper bound of p95
    const bad = r.non2xx + r.errors + r.timeouts;
    // eslint-disable-next-line no-console
    console.log(
      `non2xx ${r.non2xx}, errors ${r.errors}, timeouts ${r.timeouts}, kódy ${JSON.stringify(r.statusCodeStats)}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `požadavků ${r.requests.total}, chyb ${bad}, latence p50 ${r.latency.p50} ms, p97.5 ${p95} ms (limit ${p95BudgetMs})`,
    );
    if (bad > 0 || p95 > p95BudgetMs) process.exit(1);
  },
);
