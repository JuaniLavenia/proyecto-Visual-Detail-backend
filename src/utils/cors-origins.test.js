const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildAllowedOrigins, createCorsOriginCheck } = require('./cors-origins');

// Resolves the cors `origin` callback into the allow decision
const check = (originCheck, origin) =>
  new Promise((resolve, reject) => {
    originCheck(origin, (err, allowed) => (err ? reject(err) : resolve(allowed)));
  });

test('buildAllowedOrigins combines FRONTEND_URL and CORS_ORIGINS, trimming and ignoring empties', () => {
  const origins = buildAllowedOrigins(
    'https://visual-detail.app/',
    ' https://admin.visual-detail.app , ,http://localhost:5173,'
  );

  assert.deepEqual(origins, [
    'https://visual-detail.app',
    'https://admin.visual-detail.app',
    'http://localhost:5173',
  ]);
});

test('buildAllowedOrigins removes duplicates', () => {
  const origins = buildAllowedOrigins('http://localhost:5173', 'http://localhost:5173/');

  assert.deepEqual(origins, ['http://localhost:5173']);
});

test('buildAllowedOrigins returns an empty list when nothing is configured', () => {
  assert.deepEqual(buildAllowedOrigins('', ''), []);
  assert.deepEqual(buildAllowedOrigins(undefined, undefined), []);
});

test('origin check allows a listed origin', async () => {
  const originCheck = createCorsOriginCheck(['https://visual-detail.app']);

  assert.equal(await check(originCheck, 'https://visual-detail.app'), true);
});

test('origin check refuses an unlisted origin without raising an error', async () => {
  const originCheck = createCorsOriginCheck(['https://visual-detail.app']);

  assert.equal(await check(originCheck, 'https://evil.example'), false);
});

test('origin check allows requests without an Origin header', async () => {
  const originCheck = createCorsOriginCheck(['https://visual-detail.app']);

  assert.equal(await check(originCheck, undefined), true);
});

test('origin check allows every origin and warns when the allowlist is empty', async () => {
  const warnings = [];
  const originCheck = createCorsOriginCheck([], { warn: (msg) => warnings.push(msg) });

  assert.equal(await check(originCheck, 'https://anything.example'), true);
  assert.equal(warnings.length, 1);
});
