const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { assertProductionSecret, DEFAULT_JWT_SECRET } = require('./index');

const CONFIG_PATH = path.join(__dirname, 'index.js');

// Loads the config in a fresh process so convict reads the given environment
const loadConfigWith = (overrides) => {
  const env = { ...process.env };
  delete env.JWT_SECRET;
  delete env.NODE_ENV;
  Object.assign(env, overrides);
  return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(CONFIG_PATH)})`], {
    env,
    encoding: 'utf8',
  });
};

test('assertProductionSecret rejects a missing secret in production', () => {
  assert.throws(() => assertProductionSecret('production', ''), /JWT_SECRET/);
});

test('assertProductionSecret rejects the default secret in production', () => {
  assert.throws(() => assertProductionSecret('production', DEFAULT_JWT_SECRET), /JWT_SECRET/);
});

test('assertProductionSecret accepts a custom secret in production', () => {
  assert.doesNotThrow(() => assertProductionSecret('production', 'a-real-secret'));
});

test('assertProductionSecret allows the default secret only when NODE_ENV is explicitly development or test', () => {
  assert.doesNotThrow(() => assertProductionSecret('development', DEFAULT_JWT_SECRET));
  assert.doesNotThrow(() => assertProductionSecret('test', DEFAULT_JWT_SECRET));
});

test('assertProductionSecret rejects the default secret when NODE_ENV is unset or unknown', () => {
  assert.throws(() => assertProductionSecret(undefined, DEFAULT_JWT_SECRET), /JWT_SECRET/);
  assert.throws(() => assertProductionSecret(undefined, ''), /JWT_SECRET/);
  assert.throws(() => assertProductionSecret('staging', DEFAULT_JWT_SECRET), /JWT_SECRET/);
});

test('assertProductionSecret rejects the .env-example placeholder outside development', () => {
  assert.throws(
    () => assertProductionSecret('production', 'your-super-secret-key-change-in-production'),
    /JWT_SECRET/
  );
});

test('assertProductionSecret accepts a custom secret when NODE_ENV is unset', () => {
  assert.doesNotThrow(() => assertProductionSecret(undefined, 'a-real-secret'));
});

test('loading the config in production without JWT_SECRET fails with a clear error', () => {
  const result = loadConfigWith({ NODE_ENV: 'production' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET/);
});

test('loading the config in production with JWT_SECRET succeeds', () => {
  const result = loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: 'a-real-secret' });

  assert.equal(result.status, 0, result.stderr);
});

test('loading the config without NODE_ENV and without JWT_SECRET fails', () => {
  const result = loadConfigWith({});

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET/);
});

test('loading the config without NODE_ENV but with JWT_SECRET succeeds', () => {
  const result = loadConfigWith({ JWT_SECRET: 'a-real-secret' });

  assert.equal(result.status, 0, result.stderr);
});

test('loading the config in test keeps the default secret working', () => {
  const result = loadConfigWith({ NODE_ENV: 'test' });

  assert.equal(result.status, 0, result.stderr);
});

test('loading the config in development keeps the default secret working', () => {
  const result = loadConfigWith({ NODE_ENV: 'development' });

  assert.equal(result.status, 0, result.stderr);
});
