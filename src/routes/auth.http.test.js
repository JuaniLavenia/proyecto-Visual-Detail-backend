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
const authService = require('../services/auth.service');
const passwordResetService = require('../services/password-reset.service');
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

test('logout with an access token answers 200 but keeps the current session', async () => {
  const users = stubDefaultUsers();
  const currentHash = sha256(refreshTokenFor(USER_ID));
  users.user.refreshToken = currentHash;

  const res = await request(app).post('/api/logout').send({ refreshToken: accessTokenFor(USER_ID) });

  assert.equal(res.status, 200);
  assert.equal(users.user.refreshToken, currentHash);
  assert.deepEqual(users.user.saves, []);
});

test('logout with a stale refresh token answers 200 but keeps the current session', async () => {
  const users = stubDefaultUsers();
  const currentHash = sha256('the-current-refresh-token');
  users.user.refreshToken = currentHash;

  const res = await request(app).post('/api/logout').send({ refreshToken: refreshTokenFor(USER_ID) });

  assert.equal(res.status, 200);
  assert.equal(users.user.refreshToken, currentHash);
  assert.deepEqual(users.user.saves, []);
});

test('logout with a garbage token answers 200', async () => {
  stubDefaultUsers();

  const res = await request(app).post('/api/logout').send({ refreshToken: 'not-a-jwt' });

  assert.equal(res.status, 200);
});

test('logout without a token answers 400', async () => {
  const res = await request(app).post('/api/logout').send({});

  assert.equal(res.status, 400);
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

// ---------- password rules ----------

const PASSWORD_LENGTH_MESSAGE = 'La contraseña debe tener entre 8 y 72 caracteres';
const RESET_PATH = `/api/reset/${USER_ID}/some-token`;

const register = (password, confirmation = password) =>
  request(app)
    .post('/api/register')
    .send({ email: 'new@mail.com', password, password_confirmation: confirmation });

const fieldMessages = (res) => res.body.error.details.map((d) => [d.field, d.message]);

for (const [label, password] of [
  ['7 characters', 'a'.repeat(7)],
  ['73 characters', 'a'.repeat(73)],
]) {
  test(`register rejects a password of ${label}`, async () => {
    const res = await register(password);

    assert.equal(res.status, 400);
    assert.deepEqual(fieldMessages(res), [['password', PASSWORD_LENGTH_MESSAGE]]);
  });
}

test('register rejects a password that is not a string', async () => {
  const res = await register(['a'.repeat(10)]);

  assert.equal(res.status, 400);
  assert.deepEqual(fieldMessages(res), [['password', PASSWORD_LENGTH_MESSAGE]]);
});

test('register rejects a mismatched confirmation', async () => {
  const res = await register('a'.repeat(10), 'b'.repeat(10));

  assert.equal(res.status, 400);
  assert.deepEqual(fieldMessages(res), [['password', 'Las contraseñas no coinciden']]);
});

test('register accepts passwords of 8 and 72 characters', async () => {
  const user = { _id: USER_ID, role: 'minorista' };
  stub(authService, 'register', spy({ user, accessToken: 'a', refreshToken: 'r' }));

  for (const password of ['a'.repeat(8), 'a'.repeat(72)]) {
    const res = await register(password);
    assert.equal(res.status, 201);
  }
});

test('reset rejects a password shorter than 8 characters', async () => {
  const reset = stub(passwordResetService, 'resetPassword', spy(undefined));

  const res = await request(app).post(RESET_PATH).send({ password: 'short' });

  assert.equal(res.status, 400);
  assert.deepEqual(fieldMessages(res), [['password', PASSWORD_LENGTH_MESSAGE]]);
  assert.equal(reset.calls.length, 0);
});

test('reset accepts a valid password', async () => {
  const reset = stub(passwordResetService, 'resetPassword', spy(undefined));

  const res = await request(app).post(RESET_PATH).send({ password: 'long-enough' });

  assert.equal(res.status, 200);
  assert.equal(reset.calls.length, 1);
});

test('login keeps accepting short passwords of existing users', async () => {
  const user = { _id: USER_ID, role: 'minorista' };
  const login = stub(authService, 'login', spy({ user, accessToken: 'a', refreshToken: 'r' }));

  const res = await request(app).post('/api/login').send({ email: 'old@mail.com', password: '1234' });

  assert.equal(res.status, 200);
  assert.deepEqual(login.calls, [['old@mail.com', '1234']]);
});

for (const [field, payload] of [
  ['email', { email: ['a@mail.com'], password: 'whatever' }],
  ['password', { email: 'a@mail.com', password: { $gt: '' } }],
]) {
  test(`login rejects a non-string ${field} with 400`, async () => {
    const login = stub(authService, 'login', spy(undefined));

    const res = await request(app).post('/api/login').send(payload);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(res.body.error.details[0].field, field);
    assert.equal(login.calls.length, 0);
  });
}

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

// Supertest connects over loopback: clear every key that address can map to
const LOOPBACK_KEYS = ['::/56', '127.0.0.1', '::ffff:127.0.0.1'];
const resetLimiter = (limiter) => Promise.all(LOOPBACK_KEYS.map((key) => limiter.resetKey(key)));

test('POST /forgot answers 429 once the password reset limit is exhausted', async () => {
  // Earlier reset-password tests share this limiter's bucket
  await resetLimiter(passwordResetLimiter);
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
