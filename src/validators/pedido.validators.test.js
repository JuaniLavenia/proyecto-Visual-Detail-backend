const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');

const {
  normalizePhone,
  createPedidoValidation,
  listAdminPedidosQueryValidation,
  MAX_SEARCH_LENGTH,
} = require('./pedido.validators');

const runChains = async (chains, req) => {
  for (const chain of chains) {
    await chain.run(req);
  }
  return { req, errors: validationResult(req).array() };
};

const validateCreate = (body) => runChains(createPedidoValidation, { body });

const PRODUCTOS = [{ nombre: 'Shampoo', cantidad: 2 }];

test('normalizePhone keeps international numbers typed with + as digits only', () => {
  assert.equal(normalizePhone('+54 9 (11) 2345-6789'), '+5491123456789');
  assert.equal(normalizePhone('+1 555 123 4567'), '+15551234567');
});

test('normalizePhone converts Argentine numbers without + to +549 mobile format', () => {
  const cases = {
    '3814159688': '+5493814159688',
    '381 4159688': '+5493814159688',
    '0381 15 4159688': '+5493814159688',
    '0381-154159688': '+5493814159688',
    '11 1523456789': '+5491123456789',
    '011 15 2345 6789': '+5491123456789',
    ' 011 4567-8901 ': '+5491145678901',
    '5493814159688': '+5493814159688',
    '543814159688': '+5493814159688',
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(normalizePhone(input), expected, input);
  }
});

test('normalizePhone rejects numbers that are not a valid Argentine or international phone', () => {
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('381415968'), null);
  assert.equal(normalizePhone('12345678'), null);
  assert.equal(normalizePhone('+1234567'), null);
  assert.equal(normalizePhone('+1234567890123456'), null);
  assert.equal(normalizePhone('11-2345-678a'), null);
  assert.equal(normalizePhone('54+11 2345 6789'), null);
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone(12345678), null);
});

test('create order accepts productos with a phone and normalizes it', async () => {
  const { req, errors } = await validateCreate({ productos: PRODUCTOS, telefono: '+54 11 2345-6789' });
  assert.deepEqual(errors, []);
  assert.equal(req.body.telefono, '+541123456789');
});

test('create order normalizes a national phone to +549 format', async () => {
  const { req, errors } = await validateCreate({ productos: PRODUCTOS, telefono: '0381 15 4159688' });
  assert.deepEqual(errors, []);
  assert.equal(req.body.telefono, '+5493814159688');
});

test('create order accepts a missing phone (taken from the profile later)', async () => {
  const { errors } = await validateCreate({ productos: PRODUCTOS });
  assert.deepEqual(errors, []);
});

test('create order rejects an invalid phone', async () => {
  const { errors } = await validateCreate({ productos: PRODUCTOS, telefono: '123' });
  assert.deepEqual(errors.map((e) => e.path), ['telefono']);
  assert.match(errors[0].msg, /código de área/);
});

test('create order rejects an empty or missing productos array', async () => {
  const empty = await validateCreate({ productos: [] });
  assert.deepEqual(empty.errors.map((e) => e.path), ['productos']);

  const missing = await validateCreate({});
  assert.deepEqual(missing.errors.map((e) => e.path), ['productos']);
});

test('create order rejects products without a name or with a non-positive quantity', async () => {
  const { errors } = await validateCreate({
    productos: [{ nombre: '  ', cantidad: 1 }, { nombre: 'Cera', cantidad: 0 }],
  });
  assert.deepEqual(errors.map((e) => e.path).sort(), ['productos[0].nombre', 'productos[1].cantidad']);
});

const validateAdminList = (query) => runChains(listAdminPedidosQueryValidation, { query });

test('admin orders query accepts page, limit, estado and a trimmed search', async () => {
  const { req, errors } = await validateAdminList({
    page: '2',
    limit: '25',
    estado: 'Pendiente',
    search: '  ana@mail ',
  });
  assert.deepEqual(errors, []);
  assert.equal(req.query.search, 'ana@mail');
});

test('admin orders query rejects a too long or repeated search', async () => {
  const long = await validateAdminList({ search: 'x'.repeat(MAX_SEARCH_LENGTH + 1) });
  assert.deepEqual(long.errors.map((e) => e.path), ['search']);

  const repeated = await validateAdminList({ search: ['a', 'b'] });
  assert.deepEqual(repeated.errors.map((e) => e.path), ['search']);
});

test('admin orders query rejects out-of-range page/limit and unknown estado', async () => {
  const { errors } = await validateAdminList({ page: '0', limit: '101', estado: 'Enviado' });
  assert.deepEqual(errors.map((e) => e.path).sort(), ['estado', 'limit', 'page']);
});
