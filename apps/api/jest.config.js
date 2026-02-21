const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      { tsconfig: path.resolve(__dirname, 'tsconfig.json') },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Resolver el paquete compartido del monorepo en contexto de tests
    '^@vkbacademy/shared$': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
  },
};
