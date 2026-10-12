// Run the tests in UTC by default, like the server in Docker; TEST_TZ picks another zone
// (npm run test:tz runs the suite in several). It must be set here, before the test workers
// start: process.env inside a test file is Jest's copy and does not reach Date.
module.exports = () => {
  process.env.TZ = process.env.TEST_TZ ?? 'UTC';
};
