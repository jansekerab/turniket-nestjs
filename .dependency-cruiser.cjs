/**
 * Architecture rules, checked on every run of `npm run check`:
 *  - Domain Protection: domain/ depends on nothing — no framework, no DB driver, no other layer.
 *  - Repository Pattern: abstractions live in domain/ (or application/ for the read side),
 *    implementations in infrastructure/.
 *  - No Direct DB Access: only infrastructure/ and db/ touch the database.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-depends-on-nothing',
      comment: 'domain/ must not import application, infrastructure, ui, Nest, mysql2 or any other package.',
      severity: 'error',
      from: { path: '^src/entries/domain/' },
      to: { pathNot: '^src/entries/domain/' },
    },
    {
      name: 'application-only-domain',
      comment: 'application/ uses domain abstractions and Nest DI — not infrastructure, ui, mysql2 or the db module.',
      severity: 'error',
      from: { path: '^src/entries/application/' },
      to: { path: ['^src/entries/(infrastructure|ui)/', '^src/db/', '^src/device/', 'node_modules/mysql2'] },
    },
    {
      name: 'no-direct-db-access',
      comment: 'Only infrastructure/ (and the db and health modules wiring it) may use DbService or mysql2.',
      severity: 'error',
      from: { pathNot: ['^src/entries/infrastructure/', '^src/db/', '^src/health/', '^src/entries/entries\\.module\\.ts$'] },
      to: { path: ['^src/db/db\\.service\\.ts$', 'node_modules/mysql2'] },
    },
    {
      name: 'ui-only-application',
      comment: 'Controllers talk to the application layer, never to repositories or the device directly.',
      severity: 'error',
      from: { path: '^src/entries/ui/' },
      to: { path: ['^src/entries/infrastructure/', '^src/device/', '^src/db/'] },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'no-test-code-in-src',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^test/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
