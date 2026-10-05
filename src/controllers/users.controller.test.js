const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const userService = require('../services/user.service');
const passwordResetService = require('../services/password-reset.service');
const { AppError } = require('../middleware/error.middleware');
const { updateUser, sendPasswordResetLink, getUsers } = require('./users.controller');
const usersRouter = require('../routes/users');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');

let receivedUpdates;

beforeEach(() => {
  receivedUpdates = undefined;
  userService.update = async (_id, updates) => {
    receivedUpdates = updates;
    return { _id, ...updates };
  };
});

const run = (req) =>
  new Promise((resolve) => {
    const res = { json: (body) => resolve({ body }) };
    updateUser(req, res, (err) => resolve({ err }));
  });

const selfRequest = (body) => ({
  params: { id: 'user-1' },
  userId: 'user-1',
  userRole: 'minorista',
  body,
});

test('updateUser ignores role and password sent by the user', async () => {
  await run(selfRequest({ email: 'new@mail.com', role: 'admin', password: 'plain', refreshToken: 'x' }));

  assert.deepEqual(receivedUpdates, { email: 'new@mail.com' });
});

test('sendPasswordResetLink sends the reset link for the requested user', async () => {
  let receivedId;
  passwordResetService.sendResetLinkToUser = async (id) => {
    receivedId = id;
  };

  const result = await new Promise((resolve) => {
    const res = { json: (body) => resolve({ body }) };
    sendPasswordResetLink({ params: { id: 'user-2' } }, res, (err) => resolve({ err }));
  });

  assert.equal(receivedId, 'user-2');
  assert.equal(result.body?.success, true);
  assert.ok(result.body?.message);
});

test('sendPasswordResetLink forwards service errors', async () => {
  passwordResetService.sendResetLinkToUser = async () => {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  };

  const { err } = await new Promise((resolve) => {
    const res = { json: (body) => resolve({ body }) };
    sendPasswordResetLink({ params: { id: 'missing' } }, res, (e) => resolve({ err: e }));
  });

  assert.equal(err?.statusCode, 404);
  assert.equal(err?.code, 'USER_NOT_FOUND');
});

test('updateUser rejects a request with no editable fields', async () => {
  const { err } = await run(selfRequest({ role: 'admin' }));

  assert.equal(err?.statusCode ?? err?.status, 400);
  assert.equal(receivedUpdates, undefined);
});

// ---------- getUsers (admin list) ----------

const COUNTS = { total: 3, admins: 1, mayoristas: 1, minoristas: 1, active: 2, inactive: 1 };

test('getUsers returns the paginated page plus KPI counts over all users', async () => {
  let receivedParams;
  userService.list = async (params) => {
    receivedParams = params;
    return { users: [{ _id: 'u1' }], total: 41, page: 3, limit: 20, totalPages: 3 };
  };
  userService.getCounts = async () => COUNTS;

  const result = await new Promise((resolve) => {
    const res = { json: (body) => resolve({ body }) };
    getUsers(
      { query: { page: '3', limit: '20', search: 'ana', role: 'admin', status: 'active', sort: 'email' } },
      res,
      (err) => resolve({ err })
    );
  });

  assert.equal(result.err, undefined);
  assert.deepEqual(receivedParams, {
    page: 3,
    limit: 20,
    search: 'ana',
    role: 'admin',
    status: 'active',
    sort: 'email',
  });
  assert.deepEqual(result.body, {
    success: true,
    data: [{ _id: 'u1' }],
    pagination: { currentPage: 3, totalPages: 3, totalUsers: 41, limit: 20 },
    counts: COUNTS,
  });
});

test('getUsers leaves page and limit to the service defaults when absent', async () => {
  let receivedParams;
  userService.list = async (params) => {
    receivedParams = params;
    return { users: [], total: 0, page: 1, limit: 20, totalPages: 0 };
  };
  userService.getCounts = async () => COUNTS;

  await new Promise((resolve) => {
    getUsers({ query: {} }, { json: resolve }, resolve);
  });

  assert.equal(receivedParams.page, undefined);
  assert.equal(receivedParams.limit, undefined);
});

const findRouteHandlers = (method, path) => {
  const layer = usersRouter.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  return layer ? layer.route.stack.map((l) => l.handle) : [];
};

test('GET /users is wired behind authenticate and isAdmin', () => {
  const handlers = findRouteHandlers('get', '/users');

  assert.equal(handlers[0], authenticate);
  assert.equal(handlers[1], isAdmin);
  assert.ok(handlers.length > 3, 'query validation runs before the controller');
});

test('GET /users rejects an authenticated non-admin with 403 ADMIN_REQUIRED', async () => {
  const [, adminGuard] = findRouteHandlers('get', '/users');

  const err = await new Promise((resolve) => {
    adminGuard({ user: { role: 'mayorista' } }, {}, resolve);
  });

  assert.equal(err?.statusCode, 403);
  assert.equal(err?.code, 'ADMIN_REQUIRED');
});
