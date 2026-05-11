module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e.ts'],
  globalSetup: '<rootDir>/test/setup.ts',
  globalTeardown: '<rootDir>/test/teardown.ts',
  maxWorkers: 1,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@app/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@app/shared$': '<rootDir>/../shared/src',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      diagnostics: false,
      tsconfig: {
        module: 'commonjs',
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        strictNullChecks: false,
        noImplicitAny: false,
        skipLibCheck: true,
      },
    }],
  },
};
