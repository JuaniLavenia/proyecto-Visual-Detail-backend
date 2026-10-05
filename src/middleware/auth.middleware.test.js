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
  jwt.sign({ uid: userId }, config.get('jwt.secret'), { expiresIn: '15m' });

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
