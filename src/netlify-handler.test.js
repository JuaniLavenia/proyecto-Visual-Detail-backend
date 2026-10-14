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

const express = require('express');
const connected = async () => {};

test('returns binary responses (Excel export) byte for byte', async () => {
  const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const workbook = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x80, 0xc3, 0x28]);
  const excelApp = express();
  excelApp.get('/api/productos/export', (req, res) => {
    res.setHeader('Content-Type', XLSX_TYPE);
    res.send(workbook);
  });

  const response = await createHandler(excelApp, connected)(eventFor('GET', '/api/productos/export'), {});

  assert.equal(response.statusCode, 200);
  assert.equal(response.isBase64Encoded, true);
  assert.deepEqual(Buffer.from(response.body, 'base64'), workbook);
});

const ipEchoApp = () => {
  const ipApp = express();
  ipApp.set('trust proxy', 1);
  ipApp.get('/ip', (req, res) => res.json({ ip: req.ip ?? null }));
  return ipApp;
};

const withHeaders = (headers) => {
  const event = eventFor('GET', '/ip');
  event.headers = { ...event.headers, ...headers };
  return event;
};

test('req.ip is the client IP Netlify reports, so rate limits are per client', async () => {
  const handler = createHandler(ipEchoApp(), connected);

  const response = await handler(
    withHeaders({ 'x-nf-client-connection-ip': '5.5.5.5', 'x-forwarded-for': '9.9.9.9' }),
    {}
  );

  assert.deepEqual(JSON.parse(response.body), { ip: '5.5.5.5' });
});

test('without the Netlify header req.ip falls back to trust proxy and X-Forwarded-For', async () => {
  const handler = createHandler(ipEchoApp(), connected);

  const response = await handler(withHeaders({ 'x-forwarded-for': '7.7.7.7' }), {});

  assert.deepEqual(JSON.parse(response.body), { ip: '7.7.7.7' });
});
