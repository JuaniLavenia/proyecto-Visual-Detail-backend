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

const PHONE_MESSAGE =
  'Teléfono inválido: ingresá tu celular con código de área (ej: 381 4159688) o en formato internacional con +';

let update;

beforeEach(() => {
  stubDefaultUsers();
  update = stub(
    userService,
    'update',
    spy((id, updates) => ({ _id: id, email: `${id}@mail.com`, role: 'minorista', ...updates }))
  );
});

afterEach(restoreStubs);

const putProfile = (id, body, asId = USER_ID) =>
  request(app).put(`/api/user/${id}`).set(bearer(accessTokenFor(asId))).send(body);

const assertValidationError = (res, field, message) => {
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  const detail = res.body.error.details.find((d) => d.field === field);
  assert.ok(detail, `details include ${field}`);
  if (message) assert.equal(detail.message, message);
  assert.equal(update.calls.length, 0, 'nothing is written');
};

test('a user updates their own name (trimmed)', async () => {
  const res = await putProfile(USER_ID, { name: '  Ana Pérez  ' });

  assert.equal(res.status, 200);
  assert.deepEqual(update.calls, [[USER_ID, { name: 'Ana Pérez' }]]);
  assert.equal(res.body.data.usuario.name, 'Ana Pérez');
  assert.equal(res.body.message, 'Usuario modificado');
});

test('a user updates their own phone, normalized like checkout', async () => {
  const res = await putProfile(USER_ID, { phone: '381 15 4159688' });

  assert.equal(res.status, 200);
  assert.deepEqual(update.calls, [[USER_ID, { phone: '+5493814159688' }]]);
  assert.equal(res.body.data.usuario.phone, '+5493814159688');
});

test('an empty phone clears it (stored as null)', async () => {
  const res = await putProfile(USER_ID, { phone: '' });

  assert.equal(res.status, 200);
  assert.deepEqual(update.calls, [[USER_ID, { phone: null }]]);
  assert.equal(res.body.data.usuario.phone, null);
});

test('an invalid phone is rejected with the checkout message', async () => {
  const res = await putProfile(USER_ID, { phone: '12ab' });

  assertValidationError(res, 'phone', PHONE_MESSAGE);
});

test('a too short name is rejected', async () => {
  const res = await putProfile(USER_ID, { name: ' A ' });

  assertValidationError(res, 'name', 'El nombre debe tener entre 2 y 80 caracteres');
});

test('a too long name is rejected', async () => {
  const res = await putProfile(USER_ID, { name: 'a'.repeat(81) });

  assertValidationError(res, 'name', 'El nombre debe tener entre 2 y 80 caracteres');
});

test('the email cannot be changed through the profile', async () => {
  const res = await putProfile(USER_ID, { email: 'new@mail.com', name: 'Ana' });

  assertValidationError(res, 'email', 'El email solo lo puede cambiar un administrador');
});

for (const field of ['role', 'password', 'isActive', 'refreshToken']) {
  test(`a non editable field (${field}) is rejected`, async () => {
    const res = await putProfile(USER_ID, { name: 'Ana', [field]: 'x' });

    assertValidationError(res, field);
  });
}

test("a user cannot update another user's profile", async () => {
  const res = await putProfile(OTHER_USER_ID, { name: 'Ana' });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.equal(update.calls.length, 0);
});

test("an admin can update another user's name and phone", async () => {
  const res = await putProfile(OTHER_USER_ID, { name: 'Bruno', phone: '+54 9 11 2345-6789' }, ADMIN_ID);

  assert.equal(res.status, 200);
  assert.deepEqual(update.calls, [[OTHER_USER_ID, { name: 'Bruno', phone: '+5491123456789' }]]);
});

test('an empty body is rejected with 400', async () => {
  const res = await putProfile(USER_ID, {});

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.equal(update.calls.length, 0);
});

test('the profile response exposes name and phone but never secrets', async () => {
  stub(userService, 'findById', spy((id) => ({ _id: id, email: 'a@mail.com', role: 'minorista' })));

  const res = await request(app).get(`/api/user/${USER_ID}`).set(bearer(accessTokenFor(USER_ID)));

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.usuario, {
    _id: USER_ID,
    email: 'a@mail.com',
    role: 'minorista',
    name: null,
    phone: null,
  });
});
