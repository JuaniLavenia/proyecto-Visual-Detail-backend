const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const config = require('../config');
const User = require('../models/User');
const { authenticate, optionalAuth } = require('./auth.middleware');

const USER_ID = '64b7f0c2a1b2c3d4e5f60718';

const originalFindById = User.findById;

let fakeUser;

const accessTokenFor = (userId) =>
  jwt.sign({ uid: userId, type: 'access' }, config.get('jwt.secret'), { expiresIn: '15m' });

const run = (req) =>
  new Promise((resolve) => {
    authenticate(req, {}, (err) => resolve(err));
  });

const requestWithToken = () => ({
  headers: { authorization: `Bearer ${accessTokenFor(USER_ID)}` },
});

beforeEach(() => {
  fakeUser = { _id: USER_ID, email: 'user@mail.com', role: 'minorista' };
  User.findById = (id) => ({
    select: async () => (id === USER_ID ? fakeUser : null),
  });
});

afterEach(() => {
  User.findById = originalFindById;
});

test('authenticate attaches an active user to the request', async () => {
  fakeUser.isActive = true;
  const req = requestWithToken();

  const err = await run(req);

  assert.equal(err, undefined);
  assert.equal(req.user, fakeUser);
  assert.equal(req.userId, USER_ID);
  assert.equal(req.userRole, 'minorista');
});

test('authenticate allows a legacy user without isActive', async () => {
  const req = requestWithToken();

  const err = await run(req);

  assert.equal(err, undefined);
  assert.equal(req.user, fakeUser);
});

test('authenticate rejects an inactive user with 403 USER_INACTIVE', async () => {
  fakeUser.isActive = false;
  const req = requestWithToken();

  const err = await run(req);

  assert.equal(err.statusCode, 403);
  assert.equal(err.code, 'USER_INACTIVE');
  assert.equal(req.user, undefined);
});

// ---------- optionalAuth ----------

const runOptional = (req) =>
  new Promise((resolve) => {
    optionalAuth(req, {}, (err) => resolve(err));
  });

test('optionalAuth attaches an active or legacy user', async () => {
  const req = requestWithToken();

  const err = await runOptional(req);

  assert.equal(err, undefined);
  assert.equal(req.user, fakeUser);
  assert.equal(req.userRole, 'minorista');
});

test('optionalAuth treats an inactive user as anonymous', async () => {
  fakeUser.isActive = false;
  const req = requestWithToken();

  const err = await runOptional(req);

  assert.equal(err, undefined);
  assert.equal(req.user, undefined);
  assert.equal(req.userId, undefined);
  assert.equal(req.userRole, undefined);
});


// ---------- token type ----------

const refreshTokenFor = (userId) =>
  jwt.sign({ uid: userId, type: 'refresh' }, config.get('jwt.secret'), { expiresIn: '7d' });

const requestWithBearer = (token) => ({ headers: { authorization: `Bearer ${token}` } });

test('authenticate rejects a refresh token used as Bearer with 401 INVALID_TOKEN', async () => {
  const req = requestWithBearer(refreshTokenFor(USER_ID));

  const err = await run(req);

  assert.equal(err.statusCode, 401);
  assert.equal(err.code, 'INVALID_TOKEN');
  assert.equal(req.user, undefined);
});

test('authenticate rejects a token without a type claim', async () => {
  const legacy = jwt.sign({ uid: USER_ID }, config.get('jwt.secret'), { expiresIn: '15m' });
  const req = requestWithBearer(legacy);

  const err = await run(req);

  assert.equal(err.statusCode, 401);
  assert.equal(err.code, 'INVALID_TOKEN');
});

test('authenticate accepts an access token issued by the auth service', async () => {
  const authService = require('../services/auth.service');
  const { accessToken } = authService.generateTokens(USER_ID);
  const req = requestWithBearer(accessToken);

  const err = await run(req);

  assert.equal(err, undefined);
  assert.equal(req.user, fakeUser);
});

test('optionalAuth treats a refresh token as anonymous', async () => {
  const req = requestWithBearer(refreshTokenFor(USER_ID));

  const err = await runOptional(req);

  assert.equal(err, undefined);
  assert.equal(req.user, undefined);
  assert.equal(req.userId, undefined);
});
