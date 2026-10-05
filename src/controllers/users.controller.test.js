const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const userService = require('../services/user.service');
const passwordResetService = require('../services/password-reset.service');
const { AppError } = require('../middleware/error.middleware');
const {
  updateUser,
  sendPasswordResetLink,
  getUsers,
  createUser,
  adminUpdateUser,
  deleteUser,
  updateUserRole,
} = require('./users.controller');
const usersRouter = require('../routes/users');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');

// Every service method a test overwrites, restored after each test
const STUBBED_USER_SERVICE = ['update', 'list', 'getCounts', 'createByAdmin', 'updateByAdmin', 'deleteByAdmin', 'updateRole'];
const STUBBED_RESET_SERVICE = ['sendResetLinkToUser', 'sendInviteMail'];
const snapshot = (target, names) => Object.fromEntries(names.map((name) => [name, target[name]]));
const originalUserService = snapshot(userService, STUBBED_USER_SERVICE);
const originalResetService = snapshot(passwordResetService, STUBBED_RESET_SERVICE);
const originalConsoleError = console.error;

let receivedUpdates;

beforeEach(() => {
  receivedUpdates = undefined;
  userService.update = async (_id, updates) => {
    receivedUpdates = updates;
    return { _id, ...updates };
  };
});

afterEach(() => {
  Object.assign(userService, originalUserService);
  Object.assign(passwordResetService, originalResetService);
  console.error = originalConsoleError;
});

// Runs a controller and resolves with the status, body or forwarded error
const call = (handler, req) =>
  new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
      },
    };
    handler(req, res, (err) => resolve({ err }));
  });

const ADMIN_ID = 'admin-1';

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

for (const [method, path, controller] of [
  ['post', '/users', createUser],
  ['patch', '/users/:id', adminUpdateUser],
  ['delete', '/users/:id', deleteUser],
  ['put', '/users/:id/role', updateUserRole],
]) {
  test(`${method.toUpperCase()} ${path} is wired behind authenticate and isAdmin with validation`, () => {
    const handlers = findRouteHandlers(method, path);

    assert.equal(handlers[0], authenticate);
    assert.equal(handlers[1], isAdmin);
    assert.ok(handlers.length > 3, 'validation runs before the controller');
    assert.equal(handlers[handlers.length - 1], controller);
  });
}

// ---------- createUser ----------

const fakeCreatedUser = (fields) => ({
  ...fields,
  password: 'hash',
  toJSON() {
    return { _id: 'new-1', ...fields };
  },
});

test('createUser creates the user, sends the invite and answers 201 with inviteSent true', async () => {
  let receivedData;
  let invited;
  userService.createByAdmin = async (data) => {
    receivedData = data;
    return fakeCreatedUser(data);
  };
  passwordResetService.sendInviteMail = async (user) => {
    invited = user;
  };

  const result = await call(createUser, {
    userId: ADMIN_ID,
    body: { email: 'ana@mail.com', name: 'Ana', role: 'mayorista', password: 'ignored', isActive: false },
  });

  assert.equal(result.err, undefined);
  assert.deepEqual(receivedData, { email: 'ana@mail.com', name: 'Ana', role: 'mayorista' });
  assert.equal(invited.email, 'ana@mail.com');
  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.inviteSent, true);
  assert.deepEqual(result.body.data.user, { _id: 'new-1', email: 'ana@mail.com', name: 'Ana', role: 'mayorista' });
  assert.equal(result.body.data.user.password, undefined);
});

test('createUser keeps the user and answers 201 with inviteSent false when the mail fails', async () => {
  userService.createByAdmin = async (data) => fakeCreatedUser(data);
  passwordResetService.sendInviteMail = async () => {
    throw new Error('smtp down');
  };
  console.error = () => {};

  const result = await call(createUser, { userId: ADMIN_ID, body: { email: 'ana@mail.com' } });

  assert.equal(result.err, undefined);
  assert.equal(result.status, 201);
  assert.equal(result.body.data.inviteSent, false);
  assert.equal(result.body.data.user.email, 'ana@mail.com');
});

test('createUser forwards 409 EMAIL_IN_USE without sending a mail', async () => {
  let mailed = false;
  userService.createByAdmin = async () => {
    throw new AppError('El correo ya está en uso', 409, 'EMAIL_IN_USE');
  };
  passwordResetService.sendInviteMail = async () => {
    mailed = true;
  };

  const { err } = await call(createUser, { userId: ADMIN_ID, body: { email: 'ana@mail.com' } });

  assert.equal(err?.statusCode, 409);
  assert.equal(err?.code, 'EMAIL_IN_USE');
  assert.equal(mailed, false);
});

// ---------- adminUpdateUser ----------

test('adminUpdateUser forwards only whitelisted fields with the acting admin id', async () => {
  let received;
  userService.updateByAdmin = async (id, actorId, updates) => {
    received = { id, actorId, updates };
    return { _id: id, ...updates };
  };

  const result = await call(adminUpdateUser, {
    params: { id: 'user-2' },
    userId: ADMIN_ID,
    body: { name: 'Ana', email: 'a@mail.com', role: 'admin', isActive: false, password: 'x', refreshToken: 'y' },
  });

  assert.equal(result.err, undefined);
  assert.deepEqual(received, {
    id: 'user-2',
    actorId: ADMIN_ID,
    updates: { name: 'Ana', email: 'a@mail.com', role: 'admin', isActive: false },
  });
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.user.role, 'admin');
});

test('adminUpdateUser rejects a body without editable fields with 400', async () => {
  let called = false;
  userService.updateByAdmin = async () => {
    called = true;
  };

  const { err } = await call(adminUpdateUser, { params: { id: 'user-2' }, userId: ADMIN_ID, body: { password: 'x' } });

  assert.equal(err?.statusCode, 400);
  assert.equal(called, false);
});

// ---------- deleteUser ----------

test('deleteUser deletes with the acting admin id', async () => {
  let received;
  userService.deleteByAdmin = async (id, actorId) => {
    received = { id, actorId };
  };

  const result = await call(deleteUser, { params: { id: 'user-2' }, userId: ADMIN_ID });

  assert.deepEqual(received, { id: 'user-2', actorId: ADMIN_ID });
  assert.equal(result.body.success, true);
});

test('deleteUser forwards 409 USER_HAS_ORDERS', async () => {
  userService.deleteByAdmin = async () => {
    throw new AppError('Tiene pedidos', 409, 'USER_HAS_ORDERS');
  };

  const { err } = await call(deleteUser, { params: { id: 'user-2' }, userId: ADMIN_ID });

  assert.equal(err?.code, 'USER_HAS_ORDERS');
});

// ---------- updateUserRole (retrofit) ----------

test('updateUserRole passes the acting admin id so the guards apply', async () => {
  let received;
  userService.updateRole = async (id, actorId, role) => {
    received = { id, actorId, role };
    return { _id: id, role };
  };

  const result = await call(updateUserRole, { params: { id: 'user-2' }, userId: ADMIN_ID, body: { role: 'admin' } });

  assert.deepEqual(received, { id: 'user-2', actorId: ADMIN_ID, role: 'admin' });
  assert.equal(result.body.data.usuario.role, 'admin');
});

test('GET /users rejects an authenticated non-admin with 403 ADMIN_REQUIRED', async () => {
  const [, adminGuard] = findRouteHandlers('get', '/users');

  const err = await new Promise((resolve) => {
    adminGuard({ user: { role: 'mayorista' } }, {}, resolve);
  });

  assert.equal(err?.statusCode, 403);
  assert.equal(err?.code, 'ADMIN_REQUIRED');
});
