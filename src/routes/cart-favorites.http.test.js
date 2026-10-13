const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Must load first: pins the test environment and blocks DB connections
const {
  app,
  USER_ID,
  OTHER_USER_ID,
  accessTokenFor,
  bearer,
  stub,
  restoreStubs,
  stubDefaultUsers,
} = require('../test-helpers/http-app');
const request = require('supertest');

const CartItem = require('../models/Cart');
const Favorite = require('../models/Favorite');

const PRODUCT_A = '64b7f0c2a1b2c3d4e5f60801';
const PRODUCT_B = '64b7f0c2a1b2c3d4e5f60802';
const DELETED_PRODUCT = '64b7f0c2a1b2c3d4e5f60803';

// Products that still exist; DELETED_PRODUCT is missing on purpose (populate → null)
const CATALOG = new Map([
  [PRODUCT_A, { _id: PRODUCT_A, name: 'Shampoo', price: 100 }],
  [PRODUCT_B, { _id: PRODUCT_B, name: 'Cera', price: 200 }],
]);

/**
 * In-memory stand-in for a list model (cart or favorites).
 * Supports the two call shapes the controllers use:
 * `await Model.findOne({ userId })` (a document with save) and
 * `Model.findOne({ userId }).populate('products.product')` (populated view).
 */
const fakeListModel = (Model) => {
  const docs = new Map();
  const saves = [];

  const populated = (doc) =>
    doc && {
      userId: doc.userId,
      products: doc.products.map((item) => ({ ...item, product: CATALOG.get(String(item.product)) ?? null })),
    };

  const put = (userId, products) => {
    const doc = {
      userId,
      products: products.map((item, index) => ({ _id: `item-${index}`, ...item })),
    };
    doc.save = async () => {
      saves.push(userId);
      return doc;
    };
    docs.set(userId, doc);
    return doc;
  };

  stub(Model, 'findOne', ({ userId }) => {
    const doc = docs.get(String(userId)) ?? null;
    const query = Promise.resolve(doc);
    query.populate = async () => populated(docs.get(String(userId)) ?? null);
    return query;
  });

  // `new Model(...).save()` for a user without a document yet
  stub(Model.prototype, 'save', async function save() {
    const userId = String(this.userId);
    saves.push(userId);
    put(
      userId,
      this.products.map((item) => {
        const plain = { _id: String(item._id), product: String(item.product) };
        if (item.quantity !== undefined) plain.quantity = item.quantity;
        return plain;
      })
    );
    return this;
  });

  return { put, saves, docs };
};

let cart;
let favorites;

beforeEach(() => {
  stubDefaultUsers();
  cart = fakeListModel(CartItem);
  favorites = fakeListModel(Favorite);
});

afterEach(restoreStubs);

const send = (method, path, { token = accessTokenFor(USER_ID), body } = {}) => {
  const req = request(app)[method](path).set(bearer(token));
  return body ? req.send(body) : req;
};

const productIds = (res) => res.body.data.products.map((item) => item.product._id);

// ---------- cart ----------

test('GET /api/cart/:userId returns an empty list when the user has no cart', async () => {
  const res = await send('get', `/api/cart/${USER_ID}`);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, data: { products: [] }, message: 'Carrito' });
});

test('GET /api/cart/:userId returns populated items and leaves out deleted products', async () => {
  cart.put(USER_ID, [
    { product: PRODUCT_A, quantity: 2 },
    { product: DELETED_PRODUCT, quantity: 1 },
  ]);

  const res = await send('get', `/api/cart/${USER_ID}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Carrito');
  assert.deepEqual(res.body.data.products, [{ _id: 'item-0', product: CATALOG.get(PRODUCT_A), quantity: 2 }]);
});

test('POST /api/cart creates the cart and returns the updated list', async () => {
  const res = await send('post', '/api/cart', { body: { productId: PRODUCT_A, quantity: 3 } });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Producto agregado al carrito');
  assert.equal(res.body.data.products.length, 1);
  assert.deepEqual(res.body.data.products[0].product, CATALOG.get(PRODUCT_A));
  assert.equal(res.body.data.products[0].quantity, 3);
  assert.deepEqual(cart.saves, [USER_ID]);
});

test('POST /api/cart updates an existing cart and returns the updated list', async () => {
  cart.put(USER_ID, [
    { product: PRODUCT_A, quantity: 1 },
    { product: DELETED_PRODUCT, quantity: 1 },
  ]);

  const res = await send('post', '/api/cart', { body: { productId: PRODUCT_B, quantity: 2 } });

  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Producto agregado al carrito');
  assert.deepEqual(productIds(res), [PRODUCT_A, PRODUCT_B]);
  assert.equal(res.body.data.products[1].quantity, 2);
  assert.deepEqual(cart.saves, [USER_ID]);
});

test('DELETE /api/cart/:userId/:productId returns the remaining items', async () => {
  cart.put(USER_ID, [
    { product: PRODUCT_A, quantity: 1 },
    { product: PRODUCT_B, quantity: 4 },
  ]);

  const res = await send('delete', `/api/cart/${USER_ID}/${PRODUCT_A}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Producto eliminado del carrito');
  assert.deepEqual(res.body.data.products, [{ _id: 'item-1', product: CATALOG.get(PRODUCT_B), quantity: 4 }]);
});

test("GET /api/cart/:userId forbids reading another user's cart", async () => {
  const res = await send('get', `/api/cart/${OTHER_USER_ID}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test("DELETE /api/cart/:userId/:productId forbids changing another user's cart", async () => {
  cart.put(OTHER_USER_ID, [{ product: PRODUCT_A, quantity: 1 }]);

  const res = await send('delete', `/api/cart/${OTHER_USER_ID}/${PRODUCT_A}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.deepEqual(cart.saves, []);
});

// ---------- favorites ----------

test('GET /api/favorites/:userId returns an empty list when the user has no favorites', async () => {
  const res = await send('get', `/api/favorites/${USER_ID}`);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, data: { products: [] }, message: 'Favoritos' });
});

test('GET /api/favorites/:userId returns populated items and leaves out deleted products', async () => {
  favorites.put(USER_ID, [{ product: DELETED_PRODUCT }, { product: PRODUCT_B }]);

  const res = await send('get', `/api/favorites/${USER_ID}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Favoritos');
  assert.deepEqual(res.body.data.products, [{ _id: 'item-1', product: CATALOG.get(PRODUCT_B) }]);
});

test('POST /api/favorites creates the favorites and returns the updated list', async () => {
  const res = await send('post', '/api/favorites', { body: { productId: PRODUCT_A } });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Se agregó en favoritos');
  assert.deepEqual(productIds(res), [PRODUCT_A]);
  assert.deepEqual(favorites.saves, [USER_ID]);
});

test('POST /api/favorites adds to existing favorites and returns the updated list', async () => {
  favorites.put(USER_ID, [{ product: PRODUCT_A }]);

  const res = await send('post', '/api/favorites', { body: { productId: PRODUCT_B } });

  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Se agregó en favoritos');
  assert.deepEqual(productIds(res), [PRODUCT_A, PRODUCT_B]);
});

test('POST /api/favorites refuses a duplicate with 400 FAVORITE_ALREADY_EXISTS', async () => {
  favorites.put(USER_ID, [{ product: PRODUCT_A }]);

  const res = await send('post', '/api/favorites', { body: { productId: PRODUCT_A } });

  assert.equal(res.status, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: { message: 'El producto ya está en favoritos', code: 'FAVORITE_ALREADY_EXISTS' },
  });
  assert.deepEqual(favorites.saves, []);
});

test('DELETE /api/favorites/:userId/:productId returns the remaining items', async () => {
  favorites.put(USER_ID, [{ product: PRODUCT_A }, { product: PRODUCT_B }]);

  const res = await send('delete', `/api/favorites/${USER_ID}/${PRODUCT_B}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Se eliminó de favoritos');
  assert.deepEqual(res.body.data.products, [{ _id: 'item-0', product: CATALOG.get(PRODUCT_A) }]);
});

test('DELETE /api/favorites/:userId/:productId without favorites returns 400 FAVORITES_NOT_FOUND', async () => {
  const res = await send('delete', `/api/favorites/${USER_ID}/${PRODUCT_A}`);

  assert.equal(res.status, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: { message: 'No se encontraron favoritos para el usuario', code: 'FAVORITES_NOT_FOUND' },
  });
});

test("GET /api/favorites/:userId forbids reading another user's favorites", async () => {
  const res = await send('get', `/api/favorites/${OTHER_USER_ID}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test("DELETE /api/favorites/:userId/:productId forbids changing another user's favorites", async () => {
  favorites.put(OTHER_USER_ID, [{ product: PRODUCT_A }]);

  const res = await send('delete', `/api/favorites/${OTHER_USER_ID}/${PRODUCT_A}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.deepEqual(favorites.saves, []);
});
