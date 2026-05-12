module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
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
