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

test('bulk import normalizes product names (filter and replacement) and new taxonomy names', async () => {
  const created = [];
  let operations;
  stub(Brand, 'find', leanResult([]));
  stub(Category, 'find', leanResult([{ name: 'Ceras', slug: 'ceras' }]));
  stub(Brand, 'create', async (doc) => {
    created.push(doc);
    return { ...doc, toObject: () => ({ ...doc }) };
  });
  stub(Producto, 'bulkWrite', async (ops) => {
    operations = ops;
    return { upsertedCount: ops.length, modifiedCount: 0, matchedCount: 0 };
  });

  await productService.bulkUpsert([
    { name: '  cera  x ', price: 10, stock: 1, capacity: '1L', category: 'ceras', brand: ' toxic   shine ' },
  ]);

  assert.deepEqual(created, [{ name: 'Toxic shine', isActive: false }]);
  const { filter, replacement } = operations[0].replaceOne;
  assert.equal(filter.name, 'Cera x');
  assert.equal(replacement.name, 'Cera x');
  assert.equal(replacement.brand, 'Toxic shine');
  assert.equal(replacement.category, 'Ceras');
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

  await taxonomyService.update(Category, category._id, { name: ' línea   pro ' });

  assert.equal(category.name, 'Línea pro');
});
