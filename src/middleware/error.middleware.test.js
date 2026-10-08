const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const multer = require('multer');

const { errorMiddleware, AppError } = require('./error.middleware');

const originalNodeEnv = process.env.NODE_ENV;
const originalConsoleError = console.error;

const fakeRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const handle = (err) => {
  const res = fakeRes();
  errorMiddleware(err, {}, res, () => {});
  return res;
};

beforeEach(() => {
  console.error = () => {};
});

afterEach(() => {
  console.error = originalConsoleError;
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('includes the stack trace when NODE_ENV is explicitly development', () => {
  process.env.NODE_ENV = 'development';

  const res = handle(new Error('boom'));

  assert.equal(res.statusCode, 500);
  assert.ok(res.body.error.stack);
  assert.equal(res.body.error.message, 'boom');
});

test('omits the stack trace and hides internal messages when NODE_ENV is unset', () => {
  delete process.env.NODE_ENV;

  const res = handle(new Error('db connection string leaked'));

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error.stack, undefined);
  assert.equal(res.body.error.message, 'Internal server error');
});

test('omits the stack trace in production', () => {
  process.env.NODE_ENV = 'production';

  const res = handle(new Error('boom'));

  assert.equal(res.body.error.stack, undefined);
  assert.equal(res.body.error.message, 'Internal server error');
});

test('keeps operational error messages outside development', () => {
  process.env.NODE_ENV = 'production';

  const res = handle(new AppError('Pedido no encontrado', 404, 'ORDER_NOT_FOUND'));

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.message, 'Pedido no encontrado');
  assert.equal(res.body.error.code, 'ORDER_NOT_FOUND');
});

test('maps an oversized upload to 413 FILE_TOO_LARGE', () => {
  process.env.NODE_ENV = 'production';

  const res = handle(new multer.MulterError('LIMIT_FILE_SIZE', 'file'));

  assert.equal(res.statusCode, 413);
  assert.equal(res.body.error.code, 'FILE_TOO_LARGE');
});

test('maps other upload errors to 400 UPLOAD_ERROR', () => {
  process.env.NODE_ENV = 'production';

  const res = handle(new multer.MulterError('LIMIT_FILE_COUNT', 'file'));

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'UPLOAD_ERROR');
});
