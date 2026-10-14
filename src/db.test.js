const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createConnector } = require('./db');

test('connect opens the connection once and reuses it on later calls', async () => {
  let calls = 0;
  const connect = createConnector(async () => {
    calls += 1;
    return 'connection';
  });

  assert.equal(await connect(), 'connection');
  assert.equal(await connect(), 'connection');
  assert.equal(calls, 1);
});

test('concurrent calls share the same pending connection', async () => {
  let calls = 0;
  const connect = createConnector(async () => {
    calls += 1;
    return 'connection';
  });

  await Promise.all([connect(), connect(), connect()]);
  assert.equal(calls, 1);
});

test('a failed attempt is forgotten so the next call retries', async () => {
  let calls = 0;
  const connect = createConnector(async () => {
    calls += 1;
    if (calls === 1) throw new Error('unreachable');
    return 'connection';
  });

  await assert.rejects(connect(), /unreachable/);
  assert.equal(await connect(), 'connection');
  assert.equal(calls, 2);
});
