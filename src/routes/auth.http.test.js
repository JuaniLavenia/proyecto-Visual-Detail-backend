const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Must load first: pins the test environment and blocks DB connections
const {
  app,
  USER_ID,
  ADMIN_ID,
  accessTokenFor,
  refreshTokenFor,
  bearer,
  stub,
  spy,
  restoreStubs,
  stubDefaultUsers,
  findRoute,
} = require('../test-helpers/http-app');
const request = require('supertest');
const crypto = require('crypto');

const userService = require('../services/user.service');
const { authLimiter, passwordResetLimiter } = require('../middleware/rate-limiter');

afterEach(restoreStubs);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// ---------- refresh token used as an access token ----------

test('a refresh token sent as Bearer is rejected on a protected route', async () => {
  stubDefaultUsers();
  const findById = stub(userService, 'findById', spy({ _id: USER_ID }));

  const res = await request(app)
    .get(`/api/user/${USER_ID}`)
    .set(bearer(refreshTokenFor(USER_ID)));

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
  assert.equal(findById.calls.length, 0);
});

test('an admin refresh token sent as Bearer is rejected on an admin route', async () => {
  stubDefaultUsers();

  const res = await request(app)
    .get('/api/users')
    .set(bearer(refreshTokenFor(ADMIN_ID)));

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
});

test('an access token for the same user is accepted on that route', async () => {
  stubDefaultUsers();
  stub(userService, 'findById', spy({ _id: USER_ID }));

  const res = await request(app)
    .get(`/api/user/${USER_ID}`)
    .set(bearer(accessTokenFor(USER_ID)));

  assert.equal(res.status, 200);
});

// ---------- logout ----------

test('logout clears the stored refresh token hash', async () => {
  const users = stubDefaultUsers();
  const refreshToken = refreshTokenFor(USER_ID);
  users.user.refreshToken = sha256(refreshToken);

  const res = await request(app).post('/api/logout').send({ refreshToken });

  assert.equal(res.status, 200);
  assert.equal(users.user.refreshToken, null);
  assert.deepEqual(users.user.saves, [{ refreshToken: null }]);
});

test('after logout the old refresh token can no longer be refreshed', async () => {
  const users = stubDefaultUsers();
  const refreshToken = refreshTokenFor(USER_ID);
  users.user.refreshToken = sha256(refreshToken);

  await request(app).post('/api/logout').send({ refreshToken });
  const res = await request(app).post('/api/refresh').send({ refreshToken });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
});

// ---------- validation errors ----------

test('a rejected login answers the VALIDATION_ERROR contract without echoing the password', async () => {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'not-an-email', password: 'my-secret-pass' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.equal(res.body.error.message, 'El correo es incorrecto');
  assert.deepEqual(res.body.error.details, [{ field: 'email', message: 'El correo es incorrecto' }]);
  assert.ok(!res.text.includes('my-secret-pass'));
});

// ---------- rate limiters ----------

const AUTH_ROUTES = [
  ['post', '/login'],
  ['post', '/register'],
  ['post', '/refresh'],
  ['post', '/logout'],
  ['post', '/forgot'],
  ['post', '/reset/:id/:token'],
];

const handlersOf = (method, path) => {
  const route = findRoute(method, path);
  assert.ok(route, `${method.toUpperCase()} ${path} is registered`);
  return route.stack.map((layer) => layer.handle);
};

for (const [method, path] of AUTH_ROUTES) {
  test(`${method.toUpperCase()} ${path} runs authLimiter before its handler`, () => {
    const handlers = handlersOf(method, path);

    assert.equal(handlers[0], authLimiter);
  });
}

for (const path of ['/forgot', '/reset/:id/:token']) {
  test(`POST ${path} also runs the stricter passwordResetLimiter`, () => {
    const handlers = handlersOf('post', path);

    assert.ok(handlers.includes(passwordResetLimiter));
  });
}

test('POST /forgot answers 429 once the password reset limit is exhausted', async () => {
  // Invalid e-mail: the limiter counts the request, validation rejects it before any DB access
  const send = () => request(app).post('/api/forgot').send({ email: 'not-an-email' });

  for (let i = 0; i < 5; i++) {
    const res = await send();
    assert.equal(res.status, 400);
  }

  const limited = await send();
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMIT_EXCEEDED');
});

// ---------- CORS ----------

test('CORS allows the configured frontend origin', async () => {
  const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');

  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
});

test('CORS sends no allow-origin header to a foreign origin', async () => {
  const res = await request(app).get('/health').set('Origin', 'https://evil.example');

  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('CORS preflight from a foreign origin gets no allow-origin header', async () => {
  const res = await request(app)
    .options('/api/login')
    .set('Origin', 'https://evil.example')
    .set('Access-Control-Request-Method', 'POST');

  assert.equal(res.headers['access-control-allow-origin'], undefined);
});
