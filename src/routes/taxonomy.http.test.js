const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Must load first: pins the test environment and blocks DB connections
const {
  app,
  ADMIN_ID,
  accessTokenFor,
  bearer,
  stub,
  spy,
  restoreStubs,
  stubDefaultUsers,
} = require('../test-helpers/http-app');
const request = require('supertest');

const taxonomyService = require('../services/taxonomy.service');
const Brand = require('../models/Brand');
const Category = require('../models/Category');

const ITEM_ID = '64b7f0c2a1b2c3d4e5f60901';
const IMAGE = 'https://cdn.example.com/brands/toxic.png';
const HOME_ROWS = [{ _id: ITEM_ID, name: 'Toxic Shine', slug: 'toxic-shine', image: IMAGE }];

let services;

beforeEach(() => {
  stubDefaultUsers();
  services = {
    list: stub(taxonomyService, 'list', spy([{ _id: ITEM_ID, name: 'Toxic Shine' }])),
    listForHome: stub(taxonomyService, 'listForHome', spy(HOME_ROWS)),
    create: stub(taxonomyService, 'create', spy((Model, payload) => ({ _id: ITEM_ID, ...payload }))),
    update: stub(taxonomyService, 'update', spy((Model, id, payload) => ({ item: { _id: id, ...payload }, productsUpdated: 0 }))),
  };
});

afterEach(restoreStubs);

const admin = () => bearer(accessTokenFor(ADMIN_ID));

// ---------- public home listing ----------

for (const [path, Model] of [
  ['/api/brands', Brand],
  ['/api/categories', Category],
]) {
  test(`GET ${path}?home=true lists the home entries`, async () => {
    const res = await request(app).get(`${path}?home=true`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true, data: HOME_ROWS });
    assert.deepEqual(services.listForHome.calls, [[Model]]);
    assert.equal(services.list.calls.length, 0);
  });

  test(`GET ${path} without home keeps the active list`, async () => {
    const res = await request(app).get(path);

    assert.equal(res.status, 200);
    assert.deepEqual(services.list.calls, [[Model, { isActive: true }]]);
    assert.equal(services.listForHome.calls.length, 0);
  });
}

// ---------- admin validation ----------

test('POST /api/brands accepts image and showOnHome', async () => {
  const res = await request(app)
    .post('/api/brands')
    .set(admin())
    .send({ name: 'Toxic Shine', image: IMAGE, showOnHome: true });

  assert.equal(res.status, 201);
  const [, payload] = services.create.calls[0];
  assert.equal(payload.image, IMAGE);
  assert.equal(payload.showOnHome, true);
});

test('POST /api/categories accepts an empty image', async () => {
  const res = await request(app).post('/api/categories').set(admin()).send({ name: 'Perfumes', image: '' });

  assert.equal(res.status, 201);
});

for (const image of ['javascript:alert(1)', 'ftp://example.com/a.png', 'example.com/a.png', `https://e.com/${'a'.repeat(2048)}`, 42]) {
  test(`POST /api/categories rejects image ${JSON.stringify(String(image).slice(0, 30))}`, async () => {
    const res = await request(app).post('/api/categories').set(admin()).send({ name: 'Perfumes', image });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(res.body.error.details[0].field, 'image');
    assert.equal(services.create.calls.length, 0);
  });
}

test('PUT /api/brands/:id rejects a non boolean showOnHome', async () => {
  const res = await request(app).put(`/api/brands/${ITEM_ID}`).set(admin()).send({ showOnHome: 'yes' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.details[0].field, 'showOnHome');
  assert.equal(services.update.calls.length, 0);
});

test('PUT /api/categories/:id turns showOnHome "false" into false', async () => {
  const res = await request(app).put(`/api/categories/${ITEM_ID}`).set(admin()).send({ showOnHome: 'false' });

  assert.equal(res.status, 200);
  const [, , payload] = services.update.calls[0];
  assert.equal(payload.showOnHome, false);
});

test('PUT /api/brands/:id returns the updated entry as data', async () => {
  const res = await request(app).put(`/api/brands/${ITEM_ID}`).set(admin()).send({ image: IMAGE, showOnHome: true });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data._id, ITEM_ID);
  assert.equal(res.body.data.image, IMAGE);
  assert.equal(res.body.message, 'Marca actualizada');
});

test('PUT /api/categories/:id reports how many products a rename moved', async () => {
  stub(taxonomyService, 'update', spy((Model, id, payload) => ({ item: { _id: id, ...payload }, productsUpdated: 3 })));

  const res = await request(app).put(`/api/categories/${ITEM_ID}`).set(admin()).send({ name: 'Selladores' });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.name, 'Selladores');
  assert.equal(res.body.message, 'Categoría actualizada. Productos actualizados: 3');
});
