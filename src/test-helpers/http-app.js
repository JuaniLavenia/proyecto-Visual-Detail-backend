/**
 * HTTP test harness
 * Loads the real Express app (routing + middleware) for supertest without
 * ever touching MongoDB: the local .env may point at the production database.
 *
 * Require this module BEFORE anything that loads src/config: it pins the
 * environment first, and dotenv never overrides variables that are already set.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'http-test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.CORS_ORIGINS = '';
process.env.TRUST_PROXY = '0';
// Unroutable on purpose: nothing may connect, but if something tried it must not reach a real DB
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/http-tests-never-connect';

const mongoose = require('mongoose');

// Fail fast instead of buffering when a model call was not stubbed
mongoose.set('bufferCommands', false);
const refuseConnection = () => {
  throw new Error('HTTP tests must never connect to MongoDB');
};
mongoose.connect = refuseConnection;
mongoose.createConnection = refuseConnection;

const jwt = require('jsonwebtoken');
const app = require('../app');
const config = require('../config');
const User = require('../models/User');

const ADMIN_ID = '64b7f0c2a1b2c3d4e5f60701';
const USER_ID = '64b7f0c2a1b2c3d4e5f60702';
const OTHER_USER_ID = '64b7f0c2a1b2c3d4e5f60703';

const sign = (payload, expiresIn) => jwt.sign(payload, config.get('jwt.secret'), { expiresIn });

const accessTokenFor = (uid) => sign({ uid, type: 'access' }, '15m');
const refreshTokenFor = (uid) => sign({ uid, type: 'refresh', jti: `jti-${uid}` }, '7d');

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// ---------- stubs ----------

const restorers = [];

/** Replace obj[key] until restoreStubs() runs. */
const stub = (obj, key, impl) => {
  const original = obj[key];
  const hadOwn = Object.prototype.hasOwnProperty.call(obj, key);
  obj[key] = impl;
  restorers.push(() => {
    if (hadOwn) {
      obj[key] = original;
    } else {
      delete obj[key];
    }
  });
  return impl;
};

const restoreStubs = () => {
  while (restorers.length) restorers.pop()();
};

/** Records every call; resolves to `result` (or its return value when a function). */
const spy = (result) => {
  const fn = async (...args) => {
    fn.calls.push(args);
    return typeof result === 'function' ? result(...args) : result;
  };
  fn.calls = [];
  return fn;
};

const fakeUser = (id, overrides = {}) => {
  const user = {
    _id: id,
    id,
    email: `${id}@mail.com`,
    role: 'minorista',
    isActive: true,
    refreshToken: null,
    saves: [],
    ...overrides,
  };
  user.save = async () => {
    user.saves.push({ refreshToken: user.refreshToken });
    return user;
  };
  return user;
};

/**
 * Stub User.findById for both call shapes used by the app:
 * `await User.findById(id)` (services) and `User.findById(id).select(...)` (auth middleware).
 */
const stubUsers = (...users) => {
  const byId = new Map(users.map((u) => [String(u._id), u]));
  stub(User, 'findById', (id) => {
    const found = byId.get(String(id)) || null;
    const query = Promise.resolve(found);
    query.select = async () => found;
    return query;
  });
  return byId;
};

/** Default cast: one admin and two regular users. */
const stubDefaultUsers = () => {
  const users = {
    admin: fakeUser(ADMIN_ID, { role: 'admin' }),
    user: fakeUser(USER_ID),
    other: fakeUser(OTHER_USER_ID),
  };
  stubUsers(users.admin, users.user, users.other);
  return users;
};

/** Find a route registered on any router mounted on the app. */
const findRoute = (method, path) => {
  for (const layer of app._router.stack) {
    const routes = layer.route ? [layer] : layer.handle?.stack || [];
    for (const routeLayer of routes) {
      const route = routeLayer.route;
      if (route && route.path === path && route.methods[method.toLowerCase()]) {
        return route;
      }
    }
  }
  return null;
};

module.exports = {
  app,
  ADMIN_ID,
  USER_ID,
  OTHER_USER_ID,
  accessTokenFor,
  refreshTokenFor,
  bearer,
  stub,
  spy,
  restoreStubs,
  fakeUser,
  stubUsers,
  stubDefaultUsers,
  findRoute,
};
