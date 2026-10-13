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

// ---------- rename cascade ----------

const Producto = require('../models/Product');

// Records the order of every write so tests can assert nothing is written
// before the duplicate check and products follow only after the save.
// `stored` is what MongoDB holds: a write inside a transaction only lands
// there when its session commits; `sessions` records each transaction.
const renameHarness = (
  Model,
  item,
  { taken = null, modifiedCount = 0, saveError = null, updateManyError = null } = {},
) => {
  const log = [];
  const calls = { exists: [], updateMany: [], saveOptions: [], updateManyOptions: [] };
  const stored = { name: item.name, productsRenamedTo: null };
  const sessions = [];

  const write = (session, apply) => {
    if (session) session.pending.push(apply);
    else apply();
  };

  item.save = async (options) => {
    log.push('save');
    calls.saveOptions.push(options);
    if (saveError) throw saveError;
    const name = item.name;
    write(options?.session, () => {
      stored.name = name;
    });
    return item;
  };
  stub(Model, 'findById', async () => item);
  stub(Model, 'exists', async (filter) => {
    log.push('exists');
    calls.exists.push(filter);
    return taken;
  });
  stub(Model, 'startSession', async () => {
    const session = {
      pending: [],
      active: false,
      committed: false,
      aborted: false,
      ended: false,
      startTransaction() { this.active = true; },
      inTransaction() { return this.active; },
      async commitTransaction() {
        this.pending.forEach((apply) => apply());
        this.active = false;
        this.committed = true;
      },
      async abortTransaction() {
        this.pending = [];
        this.active = false;
        this.aborted = true;
      },
      async endSession() { this.ended = true; },
    };
    sessions.push(session);
    return session;
  });
  stub(Producto, 'updateMany', async (filter, update, options) => {
    log.push('updateMany');
    calls.updateMany.push([filter, update]);
    calls.updateManyOptions.push(options);
    if (updateManyError) throw updateManyError;
    const field = Object.keys(update.$set)[0];
    write(options?.session, () => {
      stored.productsRenamedTo = update.$set[field];
    });
    return { modifiedCount };
  });
  return { log, calls, stored, sessions };
};

for (const [Model, field] of [
  [Brand, 'brand'],
  [Category, 'category'],
]) {
  test(`renaming a ${Model.modelName} moves its products to the new name`, async () => {
    const item = fakeItem({ name: 'Toxic (Shine)' });
    const { log, calls } = renameHarness(Model, item, { modifiedCount: 4 });

    const result = await taxonomyService.update(Model, item._id, { name: '  toxic   shine pro ' });

    assert.equal(item.name, 'Toxic shine pro');
    assert.deepEqual(log, ['exists', 'save', 'updateMany']);
    assert.deepEqual(calls.exists, [
      { _id: { $ne: item._id }, name: { $regex: '^Toxic shine pro$', $options: 'i' } },
    ]);
    assert.deepEqual(calls.updateMany, [
      [{ [field]: { $regex: '^Toxic \\(Shine\\)$', $options: 'i' } }, { $set: { [field]: 'Toxic shine pro' } }],
    ]);
    assert.equal(result.item, item);
    assert.equal(result.productsUpdated, 4);
  });
}

test('updating other fields does not touch products', async () => {
  const item = fakeItem({ name: 'Perfumes', sortOrder: 0 });
  const { log } = renameHarness(Category, item);

  const result = await taxonomyService.update(Category, item._id, { name: 'Perfumes', sortOrder: 2 });

  assert.deepEqual(log, ['save']);
  assert.equal(item.sortOrder, 2);
  assert.equal(result.productsUpdated, 0);
});

test('a case-only rename cascades and ignores the entry itself in the duplicate check', async () => {
  const item = fakeItem({ name: 'Toxic shine' });
  const { log, calls } = renameHarness(Brand, item, { modifiedCount: 2 });

  const result = await taxonomyService.update(Brand, item._id, { name: 'Toxic Shine' });

  assert.deepEqual(log, ['exists', 'save', 'updateMany']);
  assert.deepEqual(calls.exists[0]._id, { $ne: item._id });
  assert.deepEqual(calls.updateMany[0][1], { $set: { brand: 'Toxic Shine' } });
  assert.equal(result.productsUpdated, 2);
});

test('renaming to a name another entry has is a 409 and writes nothing', async () => {
  const item = fakeItem({ name: 'Ceras' });
  const { log } = renameHarness(Category, item, { taken: { _id: 'other' } });

  await assert.rejects(taxonomyService.update(Category, item._id, { name: 'perfumes' }), (err) => {
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, 'TAXONOMY_NAME_TAKEN');
    return true;
  });
  assert.deepEqual(log, ['exists']);
  assert.equal(item.name, 'Ceras');
});

test('a duplicate key error on save is a 409 and products are not touched', async () => {
  const item = fakeItem({ name: 'Ceras' });
  const duplicate = Object.assign(new Error('E11000 duplicate key error'), { name: 'MongoServerError', code: 11000 });
  const { log } = renameHarness(Category, item, { saveError: duplicate });

  await assert.rejects(taxonomyService.update(Category, item._id, { name: 'Selladores' }), (err) => {
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, 'TAXONOMY_NAME_TAKEN');
    return true;
  });
  assert.deepEqual(log, ['exists', 'save']);
});

test('a rename saves the entry and moves its products in one committed transaction', async () => {
  const item = fakeItem({ name: 'Ceras' });
  const { calls, stored, sessions } = renameHarness(Category, item, { modifiedCount: 3 });

  const result = await taxonomyService.update(Category, item._id, { name: 'Selladores' });

  assert.equal(sessions.length, 1);
  const [session] = sessions;
  assert.equal(calls.saveOptions[0]?.session, session);
  assert.equal(calls.updateManyOptions[0]?.session, session);
  assert.equal(session.committed, true);
  assert.equal(session.ended, true);
  assert.deepEqual(stored, { name: 'Selladores', productsRenamedTo: 'Selladores' });
  assert.equal(result.productsUpdated, 3);
});

test('when moving the products fails, the rename is rolled back and the error propagates', async () => {
  const item = fakeItem({ name: 'Ceras' });
  const failure = new Error('updateMany failed');
  const { log, stored, sessions } = renameHarness(Category, item, { updateManyError: failure });

  await assert.rejects(taxonomyService.update(Category, item._id, { name: 'Selladores' }), (err) => err === failure);

  assert.deepEqual(log, ['exists', 'save', 'updateMany']);
  const [session] = sessions;
  assert.equal(session.aborted, true);
  assert.equal(session.committed, false);
  assert.equal(session.ended, true);
  assert.deepEqual(stored, { name: 'Ceras', productsRenamedTo: null });
});

test('a duplicate key error on a rename save is still a 409 and the transaction is aborted', async () => {
  const item = fakeItem({ name: 'Ceras' });
  const duplicate = Object.assign(new Error('E11000 duplicate key error'), { name: 'MongoServerError', code: 11000 });
  const { stored, sessions } = renameHarness(Category, item, { saveError: duplicate });

  await assert.rejects(taxonomyService.update(Category, item._id, { name: 'Selladores' }), (err) => {
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, 'TAXONOMY_NAME_TAKEN');
    return true;
  });
  assert.equal(sessions[0].aborted, true);
  assert.equal(sessions[0].ended, true);
  assert.equal(stored.name, 'Ceras');
});

test('updating other fields saves without a transaction', async () => {
  const item = fakeItem({ name: 'Perfumes', sortOrder: 0 });
  const { sessions, calls } = renameHarness(Category, item);

  await taxonomyService.update(Category, item._id, { sortOrder: 5 });

  assert.deepEqual(sessions, []);
  assert.equal(calls.saveOptions[0], undefined);
});

test('a duplicate key error on create is a 409', async () => {
  const duplicate = Object.assign(new Error('E11000 duplicate key error'), { name: 'MongoServerError', code: 11000 });
  stub(Brand.prototype, 'save', async () => {
    throw duplicate;
  });

  await assert.rejects(taxonomyService.create(Brand, { name: 'Toxic Shine' }), (err) => {
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, 'TAXONOMY_NAME_TAKEN');
    return true;
  });
});
