const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const passwordResetService = require('../services/password-reset.service');
const { AppError } = require('../middleware/error.middleware');
const { forgotPassword, resetPassword } = require('./auth.controller');

let calls;

beforeEach(() => {
  calls = [];
  passwordResetService.requestPasswordReset = async (email) => {
    calls.push(['request', email]);
  };
  passwordResetService.resetPassword = async (id, token, password) => {
    calls.push(['reset', id, token, password]);
  };
});

const run = (handler, req) =>
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

test('forgotPassword answers 200 with a generic message', async () => {
  const { status, body } = await run(forgotPassword, { body: { email: 'user@mail.com' } });

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data, undefined);
  assert.match(body.message, /Si el email está registrado/);
  assert.deepEqual(calls, [['request', 'user@mail.com']]);
});

test('resetPassword delegates to the service and answers 200', async () => {
  const { status, body } = await run(resetPassword, {
    params: { id: 'user-1', token: 'tok' },
    body: { password: 'nueva123' },
  });

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(calls, [['reset', 'user-1', 'tok', 'nueva123']]);
});

test('resetPassword forwards service errors to the error middleware', async () => {
  passwordResetService.resetPassword = async () => {
    throw new AppError('El link de recuperación expiró', 400, 'RESET_TOKEN_EXPIRED');
  };

  const { err } = await run(resetPassword, {
    params: { id: 'user-1', token: 'tok' },
    body: { password: 'nueva123' },
  });

  assert.equal(err.statusCode, 400);
  assert.equal(err.code, 'RESET_TOKEN_EXPIRED');
});
