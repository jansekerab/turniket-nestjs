/**
 * Integration tests: real MySQL (compose service mysql-test on 3308), real HTTP, real fake device.
 * Run: npm run test:int   (starts the DB, loads .env)
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/integration/**/*.int.ts'],
  globalSetup: '<rootDir>/test/global-setup.js',
  // One DB shared by all files — run them one after another.
  maxWorkers: 1,
  testTimeout: 30000,
};
