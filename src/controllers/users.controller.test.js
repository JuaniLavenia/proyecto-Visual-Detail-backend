const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const userService = require('../services/user.service');
const { updateUser } = require('./users.controller');

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

test('updateUser rejects a request with no editable fields', async () => {
  const { err } = await run(selfRequest({ role: 'admin' }));

  assert.equal(err?.statusCode ?? err?.status, 400);
  assert.equal(receivedUpdates, undefined);
});
