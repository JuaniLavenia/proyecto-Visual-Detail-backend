// Every write path for product, brand and category names stores the
// normalized name (see src/utils/normalize-name.js).
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const Producto = require('../models/Product');
const Brand = require('../models/Brand');
const Category = require('../models/Category');
const productService = require('./product.service');
const taxonomyService = require('./taxonomy.service');

const PRODUCT_ID = '64b7f0c2a1b2c3d4e5f60801';

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

test('product create stores the normalized name', async () => {
  stub(Producto.prototype, 'save', async function save() {
    return this;
  });

  const saved = await productService.create({
    name: '  cera   ámbar ',
    price: 10,
    stock: 1,
    capacity: '500ml',
  });

  assert.equal(saved.name, 'Cera ámbar');
});

test('product update stores the normalized name', async () => {
  let received;
  stub(Producto, 'findById', leanResult({ _id: PRODUCT_ID, name: 'Viejo' }));
  stub(Producto, 'findByIdAndUpdate', async (id, update) => {
    received = update;
    return { _id: id, ...update.$set };
  });

  await productService.update(PRODUCT_ID, { name: ' ñandú  shine ' });

  assert.equal(received.$set.name, 'Ñandú shine');
});

test('product update without a name leaves the name untouched', async () => {
  let received;
  stub(Producto, 'findById', leanResult({ _id: PRODUCT_ID, name: 'Viejo' }));
  stub(Producto, 'findByIdAndUpdate', async (id, update) => {
    received = update;
    return { _id: id };
  });

  await productService.update(PRODUCT_ID, { price: 20 });

  assert.equal('name' in received.$set, false);
});

test('bulk import stores the normalized product name and the canonical taxonomy names', async () => {
  let operations;
  stub(Brand, 'find', leanResult([{ name: 'Toxic shine', slug: 'toxic-shine', isActive: true }]));
  stub(Category, 'find', leanResult([{ name: 'Ceras', slug: 'ceras', isActive: true }]));
  stub(Producto, 'find', leanResult([]));
  stub(Producto, 'bulkWrite', async (ops) => {
    operations = ops;
    return { insertedCount: ops.length, modifiedCount: 0, matchedCount: 0 };
  });

  await productService.bulkUpsert([
    { row: 2, data: { name: '  cera  x ', price: 10, stock: 1, capacity: '1L', category: 'ceras', brand: ' toxic   shine ' } },
  ]);

  const { document } = operations[0].insertOne;
  assert.equal(document.name, 'Cera x');
  assert.equal(document.brand, 'Toxic shine');
  assert.equal(document.category, 'Ceras');
});

test('taxonomy create stores the normalized name and keeps the slug rule', async () => {
  stub(Brand.prototype, 'save', async function save() {
    await this.validate();
    return this;
  });

  const brand = await taxonomyService.create(Brand, { name: '  ámbar   detail ' });

  assert.equal(brand.name, 'Ámbar detail');
  assert.equal(brand.slug, 'ambar-detail');
});

test('taxonomy update stores the normalized name', async () => {
  const category = new Category({ name: 'Ceras' });
  stub(category, 'save', async () => category);
  stub(Category, 'findById', async () => category);
  stub(Category, 'exists', async () => null);
  stub(Producto, 'updateMany', async () => ({ modifiedCount: 0 }));
  // A rename runs in a transaction; tests never connect, so fake the session
  stub(Category, 'startSession', async () => ({
    startTransaction() {},
    inTransaction: () => false,
    async commitTransaction() {},
    async abortTransaction() {},
    async endSession() {},
  }));

  await taxonomyService.update(Category, category._id, { name: ' línea   pro ' });

  assert.equal(category.name, 'Línea pro');
});
