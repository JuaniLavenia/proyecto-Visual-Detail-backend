const { test } = require('node:test');
const assert = require('node:assert/strict');

// Must load first: pins the test environment and blocks DB connections
const { app } = require('./test-helpers/http-app');
const { createHandler } = require('./netlify-handler');

// Minimal Netlify (Lambda proxy) event for a rewritten request
const eventFor = (method, path) => ({
  httpMethod: method,
  path,
  headers: { host: 'visual-detail.netlify.app' },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: null,
  isBase64Encoded: false,
});

test('connects to MongoDB before Express handles the request', async () => {
  const order = [];
  const handler = createHandler(app, async () => {
    order.push('connect');
  });

  const response = await handler(eventFor('GET', '/health'), {});

  assert.deepEqual(order, ['connect']);
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ok');
});

test('answers 503 in the API envelope when MongoDB is unreachable', async () => {
  let reachedApp = false;
  const probeApp = (req, res) => {
    reachedApp = true;
    res.end();
  };
  const handler = createHandler(probeApp, async () => {
    throw new Error('connection refused');
  });

  const response = await handler(eventFor('GET', '/api/productos'), {});

  assert.equal(reachedApp, false);
  assert.equal(response.statusCode, 503);
  assert.match(response.headers['Content-Type'], /application\/json/);
  assert.deepEqual(JSON.parse(response.body), {
    success: false,
    error: {
      message: 'Service temporarily unavailable, please try again shortly.',
      code: 'DB_UNAVAILABLE',
    },
  });
});
