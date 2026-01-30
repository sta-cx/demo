module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/scripts/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  // Run tests in sequence for integration tests
  maxWorkers: 1,
  // Timeout for integration tests
  testTimeout: 30000,
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  // Setup files
  setupFilesAfterEnv: []
};
