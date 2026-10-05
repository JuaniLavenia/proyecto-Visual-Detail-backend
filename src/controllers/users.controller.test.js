const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const userService = require('../services/user.service');
const passwordResetService = require('../services/password-reset.service');
const { AppError } = require('../middleware/error.middleware');
const { updateUser, sendPasswordResetLink } = require('./users.controller');

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
