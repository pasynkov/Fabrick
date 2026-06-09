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
    // Force @nestjs/core and @nestjs/cqrs to resolve from the same location
    // to avoid dual-module issues (api/node_modules vs backend/node_modules).
    // Both directories have @nestjs/core but as different file instances, which
    // breaks ModuleRef identity checks in the DI container.
    '^@nestjs/cqrs$': '<rootDir>/../node_modules/@nestjs/cqrs',
    '^@nestjs/cqrs/(.*)$': '<rootDir>/../node_modules/@nestjs/cqrs/$1',
    '^@nestjs/core$': '<rootDir>/node_modules/@nestjs/core',
    '^@nestjs/core/(.*)$': '<rootDir>/node_modules/@nestjs/core/$1',
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
