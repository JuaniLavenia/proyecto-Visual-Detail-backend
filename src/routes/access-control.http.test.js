const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Must load first: pins the test environment and blocks DB connections
const {
  app,
  ADMIN_ID,
  USER_ID,
  OTHER_USER_ID,
  accessTokenFor,
  bearer,
  stub,
  spy,
  restoreStubs,
  stubDefaultUsers,
} = require('../test-helpers/http-app');
const request = require('supertest');

const userService = require('../services/user.service');
const pedidoService = require('../services/pedido.service');
const taxonomyService = require('../services/taxonomy.service');

let services;

beforeEach(() => {
  stubDefaultUsers();
  services = {
    listUsers: stub(userService, 'list', spy({ users: [], page: 1, totalPages: 0, total: 0, limit: 10 })),
    userCounts: stub(userService, 'getCounts', spy({})),
    findUser: stub(userService, 'findById', spy((id) => ({ _id: id }))),
    updateUser: stub(userService, 'update', spy((id) => ({ _id: id }))),
    adminOrders: stub(pedidoService, 'findAllWithUser', spy({ pedidos: [], total: 0 })),
    userOrders: stub(pedidoService, 'findByUser', spy([])),
    listTaxonomy: stub(taxonomyService, 'list', spy([])),
  };
});

afterEach(restoreStubs);

const send = (method, path, { token, body } = {}) => {
  let req = request(app)[method](path);
  if (token) req = req.set(bearer(token));
  return body ? req.send(body) : req;
};

// ---------- admin-only routes ----------

// `adminStatus` is what an admin gets: the auth layer let them through, and the
// request either succeeded or stopped at validation (no DB access needed).
const ADMIN_ROUTES = [
  { name: 'users admin list', method: 'get', path: '/api/users', adminStatus: 200, service: 'listUsers' },
  { name: 'orders admin list', method: 'get', path: '/api/admin/pedidos', adminStatus: 200, service: 'adminOrders' },
  { name: 'product create', method: 'post', path: '/api/productos', body: { price: -1 }, adminStatus: 400 },
  { name: 'product bulk upload', method: 'post', path: '/api/productos/bulk-upload', adminStatus: 400 },
  { name: 'taxonomy brand create', method: 'post', path: '/api/brands', body: { name: '' }, adminStatus: 400 },
  { name: 'taxonomy admin category list', method: 'get', path: '/api/categories/all', adminStatus: 200, service: 'listTaxonomy' },
];

for (const route of ADMIN_ROUTES) {
  const label = `${route.method.toUpperCase()} ${route.path} (${route.name})`;

  test(`${label} rejects a request without token with 401`, async () => {
    const res = await send(route.method, route.path, { body: route.body });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'NO_AUTH_TOKEN');
  });

  test(`${label} rejects a non-admin access token with 403`, async () => {
    const res = await send(route.method, route.path, {
      token: accessTokenFor(USER_ID),
      body: route.body,
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'ADMIN_REQUIRED');
    if (route.service) assert.equal(services[route.service].calls.length, 0);
  });

  test(`${label} lets an admin through`, async () => {
    const res = await send(route.method, route.path, {
      token: accessTokenFor(ADMIN_ID),
      body: route.body,
    });

    assert.equal(res.status, route.adminStatus);
    if (route.service) assert.equal(services[route.service].calls.length, 1);
  });
}

// ---------- ownership ----------

test("a user cannot read another user's orders", async () => {
  const res = await send('get', `/api/pedidos/${OTHER_USER_ID}`, { token: accessTokenFor(USER_ID) });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.equal(services.userOrders.calls.length, 0);
});

test('a user can read their own orders', async () => {
  const res = await send('get', `/api/pedidos/${USER_ID}`, { token: accessTokenFor(USER_ID) });

  assert.equal(res.status, 200);
  assert.deepEqual(services.userOrders.calls, [[USER_ID]]);
});

test("an admin can read any user's orders", async () => {
  const res = await send('get', `/api/pedidos/${OTHER_USER_ID}`, { token: accessTokenFor(ADMIN_ID) });

  assert.equal(res.status, 200);
  assert.deepEqual(services.userOrders.calls, [[OTHER_USER_ID]]);
});

test("a user cannot read another user's profile", async () => {
  const res = await send('get', `/api/user/${OTHER_USER_ID}`, { token: accessTokenFor(USER_ID) });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.equal(services.findUser.calls.length, 0);
});

test('a user can read their own profile', async () => {
  const res = await send('get', `/api/user/${USER_ID}`, { token: accessTokenFor(USER_ID) });

  assert.equal(res.status, 200);
  assert.deepEqual(services.findUser.calls, [[USER_ID]]);
});

test("an admin can read any user's profile", async () => {
  const res = await send('get', `/api/user/${OTHER_USER_ID}`, { token: accessTokenFor(ADMIN_ID) });

  assert.equal(res.status, 200);
  assert.deepEqual(services.findUser.calls, [[OTHER_USER_ID]]);
});

test("a user cannot update another user's profile", async () => {
  const res = await send('put', `/api/user/${OTHER_USER_ID}`, {
    token: accessTokenFor(USER_ID),
    body: { email: 'taken@mail.com' },
  });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.equal(services.updateUser.calls.length, 0);
});
