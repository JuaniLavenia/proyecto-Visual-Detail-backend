const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const Brand = require('../models/Brand');
const Category = require('../models/Category');
const taxonomyService = require('./taxonomy.service');

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

const IMAGE = 'https://cdn.example.com/brands/toxic.png';

// ---------- home listing ----------

test('listForHome returns active entries marked for the home, ordered, with the home fields only', async () => {
  const calls = {};
  const rows = [{ _id: '1', name: 'A', slug: 'a', image: IMAGE }];
  stub(Brand, 'find', (query) => {
    calls.query = query;
    const chain = {
      select: (fields) => {
        calls.select = fields;
        return chain;
      },
      sort: (sort) => {
        calls.sort = sort;
        return chain;
      },
      lean: async () => rows,
    };
    return chain;
  });

  const result = await taxonomyService.listForHome(Brand);

  assert.deepEqual(calls.query, { isActive: true, showOnHome: true });
  assert.deepEqual(calls.sort, { sortOrder: 1, name: 1 });
  assert.equal(calls.select, '_id name slug image');
  assert.equal(result, rows);
});

// ---------- create / update payloads ----------

test('create stores image and showOnHome', async () => {
  stub(Category.prototype, 'save', async function save() {
    await this.validate();
    return this;
  });

  const category = await taxonomyService.create(Category, {
    name: 'Exteriores',
    image: `  ${IMAGE}  `,
    showOnHome: true,
  });

  assert.equal(category.image, IMAGE);
  assert.equal(category.showOnHome, true);
});

test('create defaults image to empty and showOnHome to false', async () => {
  stub(Brand.prototype, 'save', async function save() {
    return this;
  });

  const brand = await taxonomyService.create(Brand, { name: 'Toxic Shine' });

  assert.equal(brand.image, '');
  assert.equal(brand.showOnHome, false);
});

test('create never turns the string "false" into showOnHome true', async () => {
  stub(Brand.prototype, 'save', async function save() {
    return this;
  });

  const brand = await taxonomyService.create(Brand, { name: 'Toxic Shine', showOnHome: 'false' });

  assert.equal(brand.showOnHome, false);
});

const fakeItem = (fields) => {
  const item = { _id: '64b7f0c2a1b2c3d4e5f60901', ...fields, saves: 0 };
  item.save = async () => {
    item.saves += 1;
    return item;
  };
  return item;
};

test('update applies image and showOnHome when present', async () => {
  const item = fakeItem({ name: 'Exteriores', image: '', showOnHome: false });
  stub(Category, 'findById', async () => item);

  await taxonomyService.update(Category, item._id, { image: IMAGE, showOnHome: true });

  assert.equal(item.image, IMAGE);
  assert.equal(item.showOnHome, true);
  assert.equal(item.saves, 1);
});

test('update keeps image and showOnHome when they are omitted', async () => {
  const item = fakeItem({ name: 'Exteriores', image: IMAGE, showOnHome: true });
  stub(Category, 'findById', async () => item);

  await taxonomyService.update(Category, item._id, { sortOrder: 3 });

  assert.equal(item.image, IMAGE);
  assert.equal(item.showOnHome, true);
});

test('update can clear the image and turn showOnHome off with "false"', async () => {
  const item = fakeItem({ name: 'Exteriores', image: IMAGE, showOnHome: true });
  stub(Category, 'findById', async () => item);

  await taxonomyService.update(Category, item._id, { image: '', showOnHome: 'false' });

  assert.equal(item.image, '');
  assert.equal(item.showOnHome, false);
});

// ---------- model ----------

test('models reject an image that is not an http(s) URL', async () => {
  const brand = new Brand({ name: 'Toxic Shine', image: 'javascript:alert(1)' });
  const category = new Category({ name: 'Perfumes', image: 'ftp://example.com/a.png' });

  await assert.rejects(brand.validate(), /image/);
  await assert.rejects(category.validate(), /image/);
});

test('models accept an empty image or an http(s) URL', async () => {
  await new Brand({ name: 'Toxic Shine', image: '' }).validate();
  await new Category({ name: 'Perfumes', image: IMAGE }).validate();
});
