// Avoid pulling @babel/core → browserslist → caniuse-lite (broken unpacker on some installs).
'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch:       ['**/*.test.js'],
  transform:       {},
  /** v8 avoids @babel/core → browserslist → caniuse-lite (often broken on Windows installs). */
  coverageProvider: 'v8',
  coveragePathIgnorePatterns: ['/node_modules/'],
};
