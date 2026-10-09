const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');

const Pedido = require('../models/Order');
const User = require('../models/User');
const Producto = require('../models/Product');
const pedidoService = require('./pedido.service');

const original = {
  save: Pedido.prototype.save,
  userUpdateOne: User.updateOne,
  productFind: Producto.find,
};

const SHAMPOO_ID = '64b7f0c2a1b2c3d4e5f60720';
const CERA_ID = '64b7f0c2a1b2c3d4e5f60721';
const KIT_ID = '64b7f0c2a1b2c3d4e5f60722';
const CATALOG = [
  { _id: SHAMPOO_ID, name: 'Shampoo', price: 1000, precioMayorista: 800 },
  { _id: CERA_ID, name: 'Cera', price: 2500.5, precioMayorista: null },
  { _id: KIT_ID, name: 'Kit', price: 0.1, precioMayorista: 0.1 },
];

let saved;
let profileUpdates;
let productQueries;

beforeEach(() => {
  saved = [];
  profileUpdates = [];
  productQueries = [];
  Producto.find = (filter) => {
    const query = { filter };
    productQueries.push(query);
    const ids = filter._id.$in.map(String);
    const chain = {
      select: (fields) => {
        query.select = fields;
        return chain;
      },
      lean: async () => CATALOG.filter((p) => ids.includes(String(p._id))),
    };
    return chain;
  };
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
  Producto.find = original.productFind;
});

const USER_ID = '64b7f0c2a1b2c3d4e5f60718';
const PRODUCTOS = [{ productId: SHAMPOO_ID, cantidad: 2 }];

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

const PHONE = '+5491145678901';
const lineObjects = (pedido) =>
  pedido.productos.map((p) => {
    const { _id, ...line } = p.toObject();
    return { ...line, producto: String(line.producto) };
  });

test('createForUser prices a minorista order with the retail price', async () => {
  const user = { _id: USER_ID, phone: PHONE, role: 'minorista' };

  const pedido = await pedidoService.createForUser(user, {
    productos: [{ productId: SHAMPOO_ID, cantidad: 2 }, { productId: CERA_ID, cantidad: 3 }],
  });

  assert.deepEqual(lineObjects(pedido), [
    { producto: SHAMPOO_ID, nombre: 'Shampoo', cantidad: 2, precio: 1000 },
    { producto: CERA_ID, nombre: 'Cera', cantidad: 3, precio: 2500.5 },
  ]);
  assert.equal(pedido.total, 9501.5);
  assert.equal(pedido.validateSync(), undefined);
  assert.equal(productQueries.length, 1);
  assert.deepEqual(productQueries[0].filter, { _id: { $in: [SHAMPOO_ID, CERA_ID] } });
  assert.deepEqual(productQueries[0].select.split(' ').sort(), ['name', 'precioMayorista', 'price']);
});

test('createForUser prices a mayorista order with the wholesale price', async () => {
  const user = { _id: USER_ID, phone: PHONE, role: 'mayorista' };

  const pedido = await pedidoService.createForUser(user, { productos: [{ productId: SHAMPOO_ID, cantidad: 2 }] });

  assert.equal(pedido.productos[0].precio, 800);
  assert.equal(pedido.total, 1600);
});

test('createForUser falls back to the retail price for a mayorista without wholesale price', async () => {
  const user = { _id: USER_ID, phone: PHONE, role: 'mayorista' };

  const pedido = await pedidoService.createForUser(user, { productos: [{ productId: CERA_ID, cantidad: 1 }] });

  assert.equal(pedido.productos[0].precio, 2500.5);
  assert.equal(pedido.total, 2500.5);
});

test('createForUser uses the retail price for admins', async () => {
  const user = { _id: USER_ID, phone: PHONE, role: 'admin' };

  const pedido = await pedidoService.createForUser(user, { productos: [{ productId: SHAMPOO_ID, cantidad: 1 }] });

  assert.equal(pedido.productos[0].precio, 1000);
});

test('createForUser rounds the total to 2 decimals', async () => {
  const user = { _id: USER_ID, phone: PHONE, role: 'minorista' };

  const pedido = await pedidoService.createForUser(user, { productos: [{ productId: KIT_ID, cantidad: 3 }] });

  assert.equal(pedido.total, 0.3);
});

test('createForUser merges duplicate product lines', async () => {
  const user = { _id: USER_ID, phone: PHONE, role: 'minorista' };

  const pedido = await pedidoService.createForUser(user, {
    productos: [
      { productId: SHAMPOO_ID, cantidad: 2 },
      { productId: CERA_ID, cantidad: 1 },
      { productId: SHAMPOO_ID, cantidad: 3 },
    ],
  });

  assert.deepEqual(
    lineObjects(pedido).map(({ producto, cantidad }) => ({ producto, cantidad })),
    [
      { producto: SHAMPOO_ID, cantidad: 5 },
      { producto: CERA_ID, cantidad: 1 },
    ]
  );
  assert.deepEqual(productQueries[0].filter, { _id: { $in: [SHAMPOO_ID, CERA_ID] } });
  assert.equal(pedido.total, 7500.5);
});

test('createForUser rejects merged lines above the maximum quantity', async () => {
  const user = { _id: USER_ID, phone: PHONE, role: 'minorista' };

  await assert.rejects(
    pedidoService.createForUser(user, {
      productos: [
        { productId: SHAMPOO_ID, cantidad: 6000 },
        { productId: SHAMPOO_ID, cantidad: 5000 },
      ],
    }),
    (err) => err.statusCode === 400 && err.code === 'VALIDATION_ERROR',
  );
  assert.equal(saved.length, 0);
});

test('createForUser rejects unknown products with 400 PRODUCT_NOT_FOUND before touching the profile', async () => {
  const user = { _id: USER_ID, phone: undefined, role: 'minorista' };

  await assert.rejects(
    pedidoService.createForUser(user, {
      productos: [{ productId: SHAMPOO_ID, cantidad: 1 }, { productId: '64b7f0c2a1b2c3d4e5f60799', cantidad: 1 }],
      telefono: '+541123456789',
    }),
    (err) =>
      err.statusCode === 400 && err.code === 'PRODUCT_NOT_FOUND' && err.message === 'Uno o más productos no existen',
  );
  assert.equal(saved.length, 0);
  assert.deepEqual(profileUpdates, []);
});

test('createForUser ignores nombre, precio and total sent by the client', async () => {
  const user = { _id: USER_ID, phone: PHONE, role: 'minorista' };

  const pedido = await pedidoService.createForUser(user, {
    productos: [{ productId: CERA_ID, cantidad: 1, nombre: 'Gratis', precio: 0, total: 0, $where: 'x' }],
    total: 0,
  });

  assert.deepEqual(lineObjects(pedido), [{ producto: CERA_ID, nombre: 'Cera', cantidad: 1, precio: 2500.5 }]);
  assert.equal(pedido.total, 2500.5);
});

test('createForUser keeps ObjectId product references castable', async () => {
  const user = { _id: USER_ID, phone: PHONE, role: 'minorista' };
  const originalFind = Producto.find;
  Producto.find = (filter) => {
    const chain = {
      select: () => chain,
      lean: async () => [{ ...CATALOG[0], _id: new Types.ObjectId(SHAMPOO_ID) }],
    };
    return chain;
  };

  try {
    const pedido = await pedidoService.createForUser(user, { productos: [{ productId: SHAMPOO_ID, cantidad: 1 }] });
    assert.equal(pedido.validateSync(), undefined);
    assert.ok(pedido.productos[0].producto instanceof Types.ObjectId);
    assert.equal(String(pedido.productos[0].producto), SHAMPOO_ID);
  } finally {
    Producto.find = originalFind;
  }
});

// ========== Order model ==========

test('Pedido stores the product reference, unit price and order total', () => {
  const productId = new Types.ObjectId();
  const pedido = new Pedido({
    usuario: USER_ID,
    productos: [{ producto: productId, nombre: 'Cera', cantidad: 2, precio: 1500.5 }],
    total: 3001,
  });

  assert.equal(pedido.validateSync(), undefined);
  const [line] = pedido.productos;
  assert.equal(String(line.producto), String(productId));
  assert.equal(line.precio, 1500.5);
  assert.equal(pedido.total, 3001);
});

test('Pedido keeps legacy orders without producto, precio or total valid', () => {
  const pedido = new Pedido({ usuario: USER_ID, productos: [{ nombre: 'Cera', cantidad: 1 }] });
  assert.equal(pedido.validateSync(), undefined);
  assert.equal(pedido.total, undefined);
});

test('Pedido rejects negative prices and totals', () => {
  const pedido = new Pedido({
    usuario: USER_ID,
    productos: [{ producto: new Types.ObjectId(), nombre: 'Cera', cantidad: 1, precio: -1 }],
    total: -1,
  });
  const err = pedido.validateSync();
  assert.ok(err.errors['productos.0.precio']);
  assert.ok(err.errors.total);
});

// ========== Admin list ==========

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
