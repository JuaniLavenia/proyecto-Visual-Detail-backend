const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const Pedido = require('../models/Order');
const User = require('../models/User');
const pedidoService = require('./pedido.service');

const original = {
  save: Pedido.prototype.save,
  userUpdateOne: User.updateOne,
};

let saved;
let profileUpdates;

beforeEach(() => {
  saved = [];
  profileUpdates = [];
  Pedido.prototype.save = async function save() {
    saved.push(this);
    return this;
  };
  User.updateOne = async (filter, update) => {
    profileUpdates.push({ filter, update });
    return { modifiedCount: 1 };
  };
});

afterEach(() => {
  Pedido.prototype.save = original.save;
  User.updateOne = original.userUpdateOne;
});

const USER_ID = '64b7f0c2a1b2c3d4e5f60718';
const PRODUCTOS = [{ nombre: 'Shampoo', cantidad: 2 }];

test('createForUser saves a provided phone to the profile and the order', async () => {
  const user = { _id: USER_ID, phone: undefined };

  const pedido = await pedidoService.createForUser(user, { productos: PRODUCTOS, telefono: '+541123456789' });

  assert.equal(pedido.telefono, '+541123456789');
  assert.equal(String(pedido.usuario), USER_ID);
  assert.deepEqual(profileUpdates, [
    { filter: { _id: USER_ID }, update: { $set: { phone: '+541123456789' } } },
  ]);
  assert.equal(saved.length, 1);
});

test('createForUser does not rewrite the profile when the phone is unchanged', async () => {
  const user = { _id: USER_ID, phone: '+541123456789' };

  const pedido = await pedidoService.createForUser(user, { productos: PRODUCTOS, telefono: '+541123456789' });

  assert.equal(pedido.telefono, '+541123456789');
  assert.deepEqual(profileUpdates, []);
});

test('createForUser uses the stored profile phone when none is provided', async () => {
  const user = { _id: USER_ID, phone: '1145678901' };

  const pedido = await pedidoService.createForUser(user, { productos: PRODUCTOS });

  assert.equal(pedido.telefono, '1145678901');
  assert.deepEqual(profileUpdates, []);
  assert.equal(saved.length, 1);
});

test('createForUser rejects with 400 PHONE_REQUIRED when there is no phone at all', async () => {
  const user = { _id: USER_ID };

  await assert.rejects(
    pedidoService.createForUser(user, { productos: PRODUCTOS }),
    (err) => err.statusCode === 400 && err.code === 'PHONE_REQUIRED',
  );
  assert.equal(saved.length, 0);
  assert.deepEqual(profileUpdates, []);
});

test('createForUser keeps only nombre and cantidad from each product', async () => {
  const user = { _id: USER_ID, phone: '1145678901' };

  const pedido = await pedidoService.createForUser(user, {
    productos: [{ nombre: 'Cera', cantidad: 1, precio: 0, $where: 'x' }],
  });

  const [producto] = pedido.productos.map((p) => p.toObject());
  assert.equal(producto.nombre, 'Cera');
  assert.equal(producto.cantidad, 1);
  assert.equal('precio' in producto, false);
});
