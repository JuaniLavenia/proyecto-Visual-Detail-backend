const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const config = require('../config');
const User = require('../models/User');
const authService = require('./auth.service');

const USER_ID = '64b7f0c2a1b2c3d4e5f60718';
const PASSWORD = 'secreta123';

const original = {
  findOne: User.findOne,
  findById: User.findById,
};

let fakeUser;

const makeUser = (overrides = {}) => ({
  id: USER_ID,
  _id: USER_ID,
  email: 'user@mail.com',
  role: 'minorista',
  refreshToken: 'stored-refresh',
  saved: false,
  async comparePassword(candidate) {
    return candidate === PASSWORD;
  },
  async save() {
    this.saved = true;
    return this;
  },
  toJSON() {
    return { _id: this._id, email: this.email, role: this.role };
  },
  ...overrides,
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const refreshTokenFor = (userId) =>
  jwt.sign({ uid: userId, type: 'refresh' }, config.get('jwt.secret'), { expiresIn: '7d' });

beforeEach(() => {
  fakeUser = makeUser();
  User.findOne = async (query) => (query.email === fakeUser.email ? fakeUser : null);
  User.findById = async (id) => (id === fakeUser.id ? fakeUser : null);
});

afterEach(() => {
  User.findOne = original.findOne;
  User.findById = original.findById;
});

// ---------- User model ----------

test('User model defaults isActive to true and exposes name and timestamps', () => {
  const user = new User({ email: 'new@mail.com', password: 'x', name: '  Ana  ' });

  assert.equal(user.isActive, true);
  assert.equal(user.name, 'Ana');
  assert.ok(User.schema.path('createdAt'), 'createdAt path exists');
  assert.ok(User.schema.path('updatedAt'), 'updatedAt path exists');
  assert.equal(user.toJSON().password, undefined);
  assert.equal(user.toJSON().refreshToken, undefined);
});

// ---------- login ----------

test('login issues and stores tokens for an active user', async () => {
  fakeUser.isActive = true;

  const result = await authService.login('USER@mail.com', PASSWORD);

  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.equal(fakeUser.refreshToken, sha256(result.refreshToken));
  assert.notEqual(fakeUser.refreshToken, result.refreshToken);
  assert.equal(fakeUser.saved, true);
});

test('login allows a legacy user without isActive', async () => {
  delete fakeUser.isActive;

  const result = await authService.login('user@mail.com', PASSWORD);

  assert.ok(result.accessToken);
  assert.equal(fakeUser.saved, true);
});

test('login rejects an inactive user with the correct password with 403 USER_INACTIVE', async () => {
  fakeUser.isActive = false;

  await assert.rejects(authService.login('user@mail.com', PASSWORD), {
    statusCode: 403,
    code: 'USER_INACTIVE',
  });
  assert.equal(fakeUser.refreshToken, 'stored-refresh');
  assert.equal(fakeUser.saved, false);
});

test('login answers AUTH_INVALID for an inactive user with a wrong password', async () => {
  fakeUser.isActive = false;

  await assert.rejects(authService.login('user@mail.com', 'wrong'), {
    statusCode: 401,
    code: 'AUTH_INVALID',
  });
  assert.equal(fakeUser.saved, false);
});

// ---------- refresh ----------

test('refresh rotates tokens for an active user', async () => {
  const token = refreshTokenFor(USER_ID);
  fakeUser.refreshToken = sha256(token);

  const result = await authService.refresh(token);

  assert.ok(result.accessToken);
  assert.notEqual(result.refreshToken, token);
  assert.equal(fakeUser.refreshToken, sha256(result.refreshToken));
});

test('refresh rejects an inactive user with 403 USER_INACTIVE and clears the stored token', async () => {
  const token = refreshTokenFor(USER_ID);
  fakeUser.refreshToken = sha256(token);
  fakeUser.isActive = false;

  await assert.rejects(authService.refresh(token), {
    statusCode: 403,
    code: 'USER_INACTIVE',
  });
  assert.equal(fakeUser.refreshToken, null);
  assert.equal(fakeUser.saved, true);
});

test('refresh rejects a reused (rotated-out) token with 401 and revokes the session', async () => {
  const oldToken = refreshTokenFor(USER_ID);
  fakeUser.refreshToken = sha256(oldToken);
  const { refreshToken: currentToken } = await authService.refresh(oldToken);
  fakeUser.saved = false;

  await assert.rejects(authService.refresh(oldToken), {
    statusCode: 401,
    code: 'INVALID_TOKEN',
  });
  assert.equal(fakeUser.refreshToken, null);
  assert.equal(fakeUser.saved, true);

  // The current session is revoked too
  await assert.rejects(authService.refresh(currentToken), { statusCode: 401 });
});

test('refresh rejects a plain-text stored token (pre-hash sessions re-login)', async () => {
  const token = refreshTokenFor(USER_ID);
  fakeUser.refreshToken = token;

  await assert.rejects(authService.refresh(token), { statusCode: 401, code: 'INVALID_TOKEN' });
});

test('refresh rejects a token after logout', async () => {
  const token = refreshTokenFor(USER_ID);
  fakeUser.refreshToken = sha256(token);
  await authService.logout(token);

  await assert.rejects(authService.refresh(token), { statusCode: 401, code: 'INVALID_TOKEN' });
  assert.equal(fakeUser.refreshToken, null);
});

test('refresh tokens issued back-to-back differ and carry a jti', () => {
  const first = authService.generateTokens(USER_ID).refreshToken;
  const second = authService.generateTokens(USER_ID).refreshToken;

  assert.notEqual(first, second);
  assert.ok(jwt.decode(first).jti);
  assert.notEqual(jwt.decode(first).jti, jwt.decode(second).jti);
});
