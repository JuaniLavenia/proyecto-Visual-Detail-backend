const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');

const { listUsersQueryValidation, MAX_SEARCH_LENGTH } = require('./user.validators');

const validate = async (query) => {
  const req = { query };
  for (const chain of listUsersQueryValidation) {
    await chain.run(req);
  }
  return { req, errors: validationResult(req).array() };
};

test('users list query accepts every supported param together', async () => {
  const { req, errors } = await validate({
    page: '2',
    limit: '50',
    search: '  ana@mail ',
    role: 'mayorista',
    status: 'inactive',
    sort: 'email',
  });

  assert.deepEqual(errors, []);
  assert.equal(req.query.search, 'ana@mail');
});

test('users list query accepts an empty query', async () => {
  const { errors } = await validate({});
  assert.deepEqual(errors, []);
});

test('users list query rejects out-of-range page and limit', async () => {
  const { errors } = await validate({ page: '0', limit: '101' });
  assert.deepEqual(errors.map((e) => e.path).sort(), ['limit', 'page']);
});

test('users list query rejects unknown role, status and sort values', async () => {
  const { errors } = await validate({ role: 'root', status: 'deleted', sort: 'createdAt' });
  assert.deepEqual(errors.map((e) => e.path).sort(), ['role', 'sort', 'status']);
});

test('users list query rejects a search longer than the cap or repeated', async () => {
  const tooLong = await validate({ search: 'a'.repeat(MAX_SEARCH_LENGTH + 1) });
  assert.deepEqual(tooLong.errors.map((e) => e.path), ['search']);

  const repeated = await validate({ search: ['a', 'b'] });
  assert.deepEqual(repeated.errors.map((e) => e.path), ['search']);
});
