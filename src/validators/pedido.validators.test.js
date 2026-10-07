const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');

const {
  normalizePhone,
  createPedidoValidation,
} = require('./pedido.validators');

const runChains = async (chains, req) => {
  for (const chain of chains) {
    await chain.run(req);
  }
  return { req, errors: validationResult(req).array() };
};

const validateCreate = (body) => runChains(createPedidoValidation, { body });

const PRODUCTOS = [{ nombre: 'Shampoo', cantidad: 2 }];

test('normalizePhone keeps an optional leading + and digits only', () => {
  assert.equal(normalizePhone('+54 9 (11) 2345-6789'), '+5491123456789');
  assert.equal(normalizePhone(' 011 4567-8901 '), '01145678901');
  assert.equal(normalizePhone('12345678'), '12345678');
});

test('normalizePhone rejects too short, too long and invalid characters', () => {
  assert.equal(normalizePhone('1234567'), null);
  assert.equal(normalizePhone('1234567890123456'), null);
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

test('create order accepts a missing phone (taken from the profile later)', async () => {
  const { errors } = await validateCreate({ productos: PRODUCTOS });
  assert.deepEqual(errors, []);
});

test('create order rejects an invalid phone', async () => {
  const { errors } = await validateCreate({ productos: PRODUCTOS, telefono: '123' });
  assert.deepEqual(errors.map((e) => e.path), ['telefono']);
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
