// Spreadsheet import (bulkUpsert): brands and categories must already exist,
// and a product is identified by normalized name + capacity + brand.
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const Producto = require('../models/Product');
const Brand = require('../models/Brand');
const Category = require('../models/Category');
const productService = require('./product.service');

const restorers = [];
const stub = (obj, key, impl) => {
  const hadOwn = Object.prototype.hasOwnProperty.call(obj, key);
  const original = obj[key];
  obj[key] = impl;
  restorers.push(() => {
    if (hadOwn) obj[key] = original;
    else delete obj[key];
  });
};

afterEach(() => {
  while (restorers.length) restorers.pop()();
});

const leanResult = (value) => () => ({ lean: async () => value });

const BRANDS = [
  { name: 'Sonax', slug: 'sonax', isActive: true },
  { name: 'Lattafa ', slug: 'lattafa', isActive: false },
];
const CATEGORIES = [
  { name: 'Ceras', slug: 'ceras', isActive: true },
  { name: 'Lavado', slug: 'lavado', isActive: true },
];

// Stubs the catalog and existing products; returns what reached bulkWrite
const setup = (existing = []) => {
  const writes = { operations: null, created: [] };
  stub(Brand, 'find', leanResult(BRANDS));
  stub(Category, 'find', leanResult(CATEGORIES));
  stub(Producto, 'find', leanResult(existing));
  stub(Brand, 'create', async (doc) => writes.created.push(doc));
  stub(Category, 'create', async (doc) => writes.created.push(doc));
  stub(Producto, 'bulkWrite', async (ops) => {
    writes.operations = ops;
    const inserted = ops.filter((op) => op.insertOne).length;
    return { insertedCount: inserted, matchedCount: ops.length - inserted, modifiedCount: ops.length - inserted };
  });
  return writes;
};

const row = (number, data) => ({
  row: number,
  data: { name: 'Cera', price: 100, stock: 1, capacity: '500ml', category: 'Ceras', brand: 'Sonax', ...data },
});

const HEADERS = { name: 'Nombre', category: 'Categoría', brand: 'Marca' };

test('rejects rows whose brand or category does not exist or is inactive, without writing', async () => {
  const writes = setup();

  const result = await productService.bulkUpsert(
    [row(2, { brand: 'Lattafa' }), row(3, { category: 'Perfumes', brand: 'Inventada' })],
    HEADERS
  );

  assert.deepEqual(result.errors, [
    { row: 2, column: 'Marca', message: 'La marca "Lattafa" no existe o no está activa. Creala en el admin o corregí la planilla' },
    { row: 3, column: 'Categoría', message: 'La categoría "Perfumes" no existe o no está activa. Creala en el admin o corregí la planilla' },
    { row: 3, column: 'Marca', message: 'La marca "Inventada" no existe o no está activa. Creala en el admin o corregí la planilla' },
  ]);
  assert.equal(writes.operations, null);
  assert.deepEqual(writes.created, []);
});

test('stores the canonical brand and category names and the normalized product name', async () => {
  const writes = setup();

  const result = await productService.bulkUpsert(
    [row(2, { name: '  cera   ámbar ', brand: 'SONAX', category: 'ceras' })],
    HEADERS
  );

  assert.deepEqual(result, { errors: [], total: 1, upserted: 1, modified: 0, matched: 0 });
  assert.deepEqual(writes.operations, [
    {
      insertOne: {
        document: { name: 'Cera ámbar', price: 100, stock: 1, capacity: '500ml', category: 'Ceras', brand: 'Sonax' },
      },
    },
  ]);
});

test('matches an existing product by name + capacity + brand ignoring case, accents and spaces', async () => {
  const writes = setup([
    { _id: 'p1', name: 'Cera Ámbar', capacity: '500 ml', brand: 'Sonax', category: 'Ceras' },
  ]);

  const result = await productService.bulkUpsert(
    [row(2, { name: 'cera  ambar', capacity: '500ML', category: 'Lavado', price: 250 })],
    HEADERS
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(writes.operations, [
    {
      replaceOne: {
        filter: { _id: 'p1' },
        replacement: { name: 'Cera ambar', price: 250, stock: 1, capacity: '500ML', category: 'Lavado', brand: 'Sonax' },
      },
    },
  ]);
});

test('reports two rows of the same file that are the same product', async () => {
  const writes = setup();

  const result = await productService.bulkUpsert(
    [row(2, { name: 'Cera Pro' }), row(3, { name: 'Shampoo' }), row(4, { name: 'cera  PRO' })],
    HEADERS
  );

  assert.deepEqual(result.errors, [
    { row: 4, column: 'Nombre', message: 'Es el mismo producto que la fila 2 (mismo nombre, capacidad y marca)' },
  ]);
  assert.equal(writes.operations, null);
});

test('reports a row that matches several existing products', async () => {
  const writes = setup([
    { _id: 'p1', name: 'Cera', capacity: '500ml', brand: 'Sonax' },
    { _id: 'p2', name: 'cera ', capacity: '500ml', brand: 'Sonax' },
  ]);

  const result = await productService.bulkUpsert([row(2)], HEADERS);

  assert.deepEqual(result.errors, [
    {
      row: 2,
      column: 'Nombre',
      message: 'Coincide con 2 productos que ya están cargados (están duplicados). Borrá los repetidos o usá "Reemplazar catálogo"',
    },
  ]);
  assert.equal(writes.operations, null);
});

test('without the header names, errors use the template column names', async () => {
  setup();

  const result = await productService.bulkUpsert([row(2, { brand: 'Nada' })]);

  assert.equal(result.errors[0].column, 'marca');
});

// Replace mode: validate everything, then delete all products and insert the
// sheet in one transaction
const fakeSession = () => {
  const events = [];
  const session = {
    events,
    startTransaction: () => events.push('start'),
    inTransaction: () => events.includes('start') && !events.includes('commit'),
    commitTransaction: async () => events.push('commit'),
    abortTransaction: async () => events.push('abort'),
    endSession: async () => events.push('end'),
  };
  stub(Producto, 'startSession', async () => session);
  return session;
};

test('replaceCatalog deletes every product and inserts the sheet in one transaction', async () => {
  // Stored duplicates do not matter: the whole catalog is replaced
  setup([
    { _id: 'p1', name: 'Cera', capacity: '500ml', brand: 'Sonax' },
    { _id: 'p2', name: 'cera', capacity: '500ml', brand: 'Sonax' },
  ]);
  const session = fakeSession();
  const calls = [];
  stub(Producto, 'deleteMany', async (filter, options) => {
    calls.push(['deleteMany', filter, options.session]);
    return { deletedCount: 2 };
  });
  stub(Producto, 'insertMany', async (docs, options) => {
    calls.push(['insertMany', docs, options.session]);
    return docs;
  });

  const result = await productService.replaceCatalog(
    [row(2, { brand: 'sonax' }), row(3, { name: '  shampoo ', category: 'lavado' })],
    HEADERS
  );

  assert.deepEqual(result, { errors: [], total: 2, deleted: 2, inserted: 2 });
  assert.deepEqual(calls, [
    ['deleteMany', {}, session],
    [
      'insertMany',
      [
        { name: 'Cera', price: 100, stock: 1, capacity: '500ml', category: 'Ceras', brand: 'Sonax' },
        { name: 'Shampoo', price: 100, stock: 1, capacity: '500ml', category: 'Lavado', brand: 'Sonax' },
      ],
      session,
    ],
  ]);
  assert.deepEqual(session.events, ['start', 'commit', 'end']);
});

test('replaceCatalog with any invalid row deletes nothing', async () => {
  setup();
  let started = false;
  stub(Producto, 'startSession', async () => {
    started = true;
  });
  stub(Producto, 'deleteMany', async () => assert.fail('must not delete'));

  const result = await productService.replaceCatalog(
    [row(2), row(3, { brand: 'Inventada' }), row(4, { name: 'CERA' })],
    HEADERS
  );

  assert.deepEqual(result.errors, [
    { row: 3, column: 'Marca', message: 'La marca "Inventada" no existe o no está activa. Creala en el admin o corregí la planilla' },
    { row: 4, column: 'Nombre', message: 'Es el mismo producto que la fila 2 (mismo nombre, capacidad y marca)' },
  ]);
  assert.equal(started, false);
});

test('replaceCatalog never empties the catalog with a sheet without products', async () => {
  setup();
  stub(Producto, 'deleteMany', async () => assert.fail('must not delete'));

  const result = await productService.replaceCatalog([], HEADERS);

  assert.deepEqual(result.errors, [
    { row: null, column: null, message: 'La planilla no tiene productos. El catálogo no se modificó.' },
  ]);
});

test('replaceCatalog rolls back the delete when the insert fails', async () => {
  setup();
  const session = fakeSession();
  stub(Producto, 'deleteMany', async () => ({ deletedCount: 5 }));
  stub(Producto, 'insertMany', async () => {
    throw new Error('write conflict');
  });

  await assert.rejects(productService.replaceCatalog([row(2)], HEADERS), /write conflict/);
  assert.deepEqual(session.events, ['start', 'abort', 'end']);
});
