module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/webServer.js',
    '!server/routes.js',
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
  ],
  verbose: true,
};