module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e.ts'],
  globalSetup: '<rootDir>/test/setup.ts',
  globalTeardown: '<rootDir>/test/teardown.ts',
  maxWorkers: 1,
  moduleNameMapper: {
    '^@app/shared$': '<rootDir>/../shared/src',
    '^@app/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  modulePaths: ['<rootDir>/../node_modules'],
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
        paths: {
          '@app/shared': ['../shared/src'],
          '@app/shared/*': ['../shared/src/*'],
        },
      },
    }],
  },
};
