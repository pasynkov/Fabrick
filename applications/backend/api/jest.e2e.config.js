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
    // Pin all @nestjs/* packages to the hoisted backend/node_modules copy so
    // source code and test runtime share a single instance. Multiple copies
    // (api/node_modules + backend/node_modules) produce distinct Symbol/class
    // identities that break ModuleRef checks and Version() metadata reads.
    '^@nestjs/([^/]+)$': '<rootDir>/../node_modules/@nestjs/$1',
    '^@nestjs/([^/]+)/(.*)$': '<rootDir>/../node_modules/@nestjs/$1/$2',
    '^typeorm$': '<rootDir>/../node_modules/typeorm',
    '^typeorm/(.*)$': '<rootDir>/../node_modules/typeorm/$1',
    '^class-transformer$': '<rootDir>/../node_modules/class-transformer',
    '^class-transformer/(.*)$': '<rootDir>/../node_modules/class-transformer/$1',
    '^class-validator$': '<rootDir>/../node_modules/class-validator',
    '^class-validator/(.*)$': '<rootDir>/../node_modules/class-validator/$1',
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
