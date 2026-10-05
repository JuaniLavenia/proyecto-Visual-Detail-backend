const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');

const {
  listUsersQueryValidation,
  createUserValidation,
  updateUserValidation,
  userIdParamValidation,
  MAX_SEARCH_LENGTH,
  MAX_NAME_LENGTH,
} = require('./user.validators');

const runChains = async (chains, req) => {
  for (const chain of chains) {
    await chain.run(req);
  }
  return { req, errors: validationResult(req).array() };
};

const validate = (query) => runChains(listUsersQueryValidation, { query });

const VALID_ID = '64b7f0c2a1b2c3d4e5f60718';

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

// ---------- POST /users ----------

const validateCreate = (body) => runChains(createUserValidation, { body });

test('create user accepts email, name and role and normalizes the email', async () => {
  const { req, errors } = await validateCreate({ email: '  Ana@Mail.COM ', name: ' Ana ', role: 'mayorista' });

  assert.deepEqual(errors, []);
  assert.equal(req.body.email, 'ana@mail.com');
  assert.equal(req.body.name, 'Ana');
});

test('create user requires a valid email', async () => {
  const missing = await validateCreate({ name: 'Ana' });
  assert.deepEqual(missing.errors.map((e) => e.path), ['email']);

  const invalid = await validateCreate({ email: 'not-an-email' });
  assert.deepEqual(invalid.errors.map((e) => e.path), ['email']);
});

test('create user rejects an unknown role and a too long name', async () => {
  const { errors } = await validateCreate({
    email: 'ana@mail.com',
    role: 'root',
    name: 'a'.repeat(MAX_NAME_LENGTH + 1),
  });
  assert.deepEqual(errors.map((e) => e.path).sort(), ['name', 'role']);
});

// ---------- PATCH /users/:id ----------

const validateUpdate = (body, id = VALID_ID) => runChains(updateUserValidation, { params: { id }, body });

test('update user accepts the whitelisted fields', async () => {
  const { req, errors } = await validateUpdate({
    name: 'Ana',
    email: ' ANA@mail.com',
    role: 'admin',
    isActive: false,
  });

  assert.deepEqual(errors, []);
  assert.equal(req.body.email, 'ana@mail.com');
});

test('update user rejects an empty body and unknown fields', async () => {
  const empty = await validateUpdate({});
  assert.equal(empty.errors.length, 1);

  const unknown = await validateUpdate({ name: 'Ana', password: 'x' });
  assert.equal(unknown.errors.length, 1);
});

test('update user requires a real boolean isActive and a valid id', async () => {
  const stringFlag = await validateUpdate({ isActive: 'false' });
  assert.deepEqual(stringFlag.errors.map((e) => e.path), ['isActive']);

  const badId = await validateUpdate({ name: 'Ana' }, 'nope');
  assert.deepEqual(badId.errors.map((e) => e.path), ['id']);
});

test('user id param validation rejects a non MongoId', async () => {
  const ok = await runChains(userIdParamValidation, { params: { id: VALID_ID } });
  assert.deepEqual(ok.errors, []);

  const bad = await runChains(userIdParamValidation, { params: { id: '123' } });
  assert.deepEqual(bad.errors.map((e) => e.path), ['id']);
});
