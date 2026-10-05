const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
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
  assert.equal(fakeUser.refreshToken, result.refreshToken);
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
  fakeUser.refreshToken = token;

  const result = await authService.refresh(token);

  assert.ok(result.accessToken);
  assert.equal(fakeUser.refreshToken, result.refreshToken);
});

test('refresh rejects an inactive user with 403 USER_INACTIVE and clears the stored token', async () => {
  const token = refreshTokenFor(USER_ID);
  fakeUser.refreshToken = token;
  fakeUser.isActive = false;

  await assert.rejects(authService.refresh(token), {
    statusCode: 403,
    code: 'USER_INACTIVE',
  });
  assert.equal(fakeUser.refreshToken, null);
  assert.equal(fakeUser.saved, true);
});
