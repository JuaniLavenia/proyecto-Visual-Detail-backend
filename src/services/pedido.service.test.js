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

test('createForUser keeps an ObjectId user id castable (req.user is a document)', async () => {
  const { Types } = require('mongoose');
  const user = { _id: new Types.ObjectId(USER_ID), phone: '+541123456789' };

  const pedido = await pedidoService.createForUser(user, { productos: PRODUCTOS });

  assert.equal(pedido.validateSync(), undefined);
  assert.equal(String(pedido.usuario), USER_ID);
});

test('createForUser does not rewrite the profile when the phone is unchanged', async () => {
  const user = { _id: USER_ID, phone: '+541123456789' };

  const pedido = await pedidoService.createForUser(user, { productos: PRODUCTOS, telefono: '+541123456789' });

  assert.equal(pedido.telefono, '+541123456789');
  assert.deepEqual(profileUpdates, []);
});

test('createForUser uses the stored profile phone when none is provided', async () => {
  const user = { _id: USER_ID, phone: '+5491145678901' };

  const pedido = await pedidoService.createForUser(user, { productos: PRODUCTOS });

  assert.equal(pedido.telefono, '+5491145678901');
  assert.deepEqual(profileUpdates, []);
  assert.equal(saved.length, 1);
});

test('createForUser normalizes a legacy stored phone and updates the profile', async () => {
  const { Types } = require('mongoose');
  const _id = new Types.ObjectId(USER_ID);
  const user = { _id, phone: '3814159688' };

  const pedido = await pedidoService.createForUser(user, { productos: PRODUCTOS });

  assert.equal(pedido.telefono, '+5493814159688');
  assert.deepEqual(profileUpdates, [
    { filter: { _id }, update: { $set: { phone: '+5493814159688' } } },
  ]);
  assert.equal(saved.length, 1);
});

test('createForUser rejects with 400 PHONE_REQUIRED when the stored phone is not normalizable', async () => {
  const { Types } = require('mongoose');
  const user = { _id: new Types.ObjectId(USER_ID), phone: '12345' };

  await assert.rejects(
    pedidoService.createForUser(user, { productos: PRODUCTOS }),
    (err) => err.statusCode === 400 && err.code === 'PHONE_REQUIRED',
  );
  assert.equal(saved.length, 0);
  assert.deepEqual(profileUpdates, []);
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
  const user = { _id: USER_ID, phone: '+5491145678901' };

  const pedido = await pedidoService.createForUser(user, {
    productos: [{ nombre: 'Cera', cantidad: 1, precio: 0, $where: 'x' }],
  });

  const [producto] = pedido.productos.map((p) => p.toObject());
  assert.equal(producto.nombre, 'Cera');
  assert.equal(producto.cantidad, 1);
  assert.equal('precio' in producto, false);
});

// ========== Admin list ==========

const { Types } = require('mongoose');
const { buildPedidoFilter, toAdminOrder } = pedidoService;

test('buildPedidoFilter returns an empty filter without estado or search', () => {
  assert.deepEqual(buildPedidoFilter({}), {});
  assert.deepEqual(buildPedidoFilter({ estado: 'todos', search: '   ' }), {});
});

test('buildPedidoFilter keeps a known estado and ignores unknown values', () => {
  assert.deepEqual(buildPedidoFilter({ estado: 'Completado' }), { estado: 'Completado' });
  assert.deepEqual(buildPedidoFilter({ estado: { $ne: null } }), {});
});

test('buildPedidoFilter matches a numeric search by order number, phone and users', () => {
  const ids = [new Types.ObjectId()];
  const filter = buildPedidoFilter({ estado: 'Pendiente', search: ' 42 ', userIds: ids });

  assert.deepEqual(filter, {
    estado: 'Pendiente',
    $or: [
      { numeroPedido: 42 },
      { telefono: { $regex: '42', $options: 'i' } },
      { usuario: { $in: ids } },
    ],
  });
});

test('buildPedidoFilter compacts a phone-like search and escapes it', () => {
  const filter = buildPedidoFilter({ search: '+54 (11) 2345-6789' });
  assert.deepEqual(filter, {
    $or: [{ telefono: { $regex: '\\+541123456789', $options: 'i' } }],
  });
});

test('buildPedidoFilter escapes a text search and skips the user clause without matches', () => {
  const filter = buildPedidoFilter({ search: 'ana.*@mail', userIds: [] });
  assert.deepEqual(filter, {
    $or: [{ telefono: { $regex: 'ana\\.\\*@mail', $options: 'i' } }],
  });
});

test('toAdminOrder uses createdAt as fecha when present', () => {
  const createdAt = new Date('2026-10-01T12:00:00Z');
  const order = toAdminOrder({ _id: new Types.ObjectId(), createdAt, telefono: '1145678901' });
  assert.equal(order.fecha, createdAt);
  assert.equal(order.telefono, '1145678901');
});

test('toAdminOrder falls back to the ObjectId timestamp for legacy orders', () => {
  const legacyDate = new Date('2024-03-05T10:20:30Z');
  const _id = Types.ObjectId.createFromTime(legacyDate.getTime() / 1000);
  const order = toAdminOrder({ _id });
  assert.equal(order.fecha.toISOString(), legacyDate.toISOString());
  assert.equal(order.telefono, null);
});

test('findAllWithUser resolves matching users, filters, sorts newest first and counts', async () => {
  const userId = new Types.ObjectId();
  const orderId = new Types.ObjectId();
  const received = {};
  const originals = { find: Pedido.find, count: Pedido.countDocuments, userFind: User.find };

  User.find = (filter) => {
    received.userFilter = filter;
    const chain = {
      select: () => chain,
      lean: async () => [{ _id: userId }],
    };
    return chain;
  };
  Pedido.find = (filter) => {
    received.filter = filter;
    const chain = {
      populate: (path, fields) => {
        received.populate = [path, fields];
        return chain;
      },
      sort: (sort) => {
        received.sort = sort;
        return chain;
      },
      skip: (skip) => {
        received.skip = skip;
        return chain;
      },
      limit: (limit) => {
        received.limit = limit;
        return chain;
      },
      lean: async () => [{ _id: orderId, numeroPedido: 3, estado: 'Pendiente', usuario: { _id: userId } }],
    };
    return chain;
  };
  Pedido.countDocuments = async (filter) => {
    received.countFilter = filter;
    return 23;
  };

  try {
    const result = await pedidoService.findAllWithUser({ page: 2, limit: 10, estado: 'Pendiente', search: 'ana' });

    assert.deepEqual(received.userFilter.$or.map((c) => Object.keys(c)[0]), ['email', 'name']);
    assert.deepEqual(received.filter.$or.at(-1), { usuario: { $in: [userId] } });
    assert.equal(received.filter.estado, 'Pendiente');
    assert.equal(received.countFilter, received.filter);
    assert.deepEqual(received.populate, ['usuario', 'email role name phone']);
    assert.deepEqual(received.sort, { _id: -1 });
    assert.equal(received.skip, 10);
    assert.equal(received.limit, 10);

    assert.equal(result.total, 23);
    assert.equal(result.page, 2);
    assert.equal(result.limit, 10);
    assert.equal(result.totalPages, 3);
    assert.equal(result.pedidos.length, 1);
    assert.equal(result.pedidos[0].fecha.getTime(), orderId.getTimestamp().getTime());
    assert.equal(result.pedidos[0].telefono, null);
  } finally {
    Pedido.find = originals.find;
    Pedido.countDocuments = originals.count;
    User.find = originals.userFind;
  }
});

test('findAllWithUser skips the user lookup without a search', async () => {
  const originals = { find: Pedido.find, count: Pedido.countDocuments, userFind: User.find };
  let userLookups = 0;
  let filter;
  User.find = () => {
    userLookups += 1;
    throw new Error('should not be called');
  };
  Pedido.find = (f) => {
    filter = f;
    const chain = {
      populate: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      lean: async () => [],
    };
    return chain;
  };
  Pedido.countDocuments = async () => 0;

  try {
    const result = await pedidoService.findAllWithUser({ page: 1, limit: 10, estado: 'todos' });
    assert.equal(userLookups, 0);
    assert.deepEqual(filter, {});
    assert.deepEqual(result, { pedidos: [], total: 0, page: 1, limit: 10, totalPages: 0 });
  } finally {
    Pedido.find = originals.find;
    Pedido.countDocuments = originals.count;
    User.find = originals.userFind;
  }
});
