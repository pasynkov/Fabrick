module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@app/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@app/shared$': '<rootDir>/../shared/src',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
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
