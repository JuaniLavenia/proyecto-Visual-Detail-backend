const test = require('node:test');
const assert = require('node:assert/strict');

const { planIntegrity, INDEXED_MODELS } = require('./plan-integrity');

const clean = {
  cartDuplicates: [],
  favoriteDuplicates: [],
  orderNumberDuplicates: [],
  highestOrderNumber: 120,
  counterSeq: null,
};

test('without duplicates every model gets its indexes and nothing is refused', () => {
  const plan = planIntegrity(clean);

  assert.deepEqual(plan.indexModels, INDEXED_MODELS);
  assert.deepEqual(plan.indexModels, ['Pedido', 'Producto', 'CartItem', 'Favorite']);
  assert.deepEqual(plan.refusals, []);
  assert.equal(plan.clean, true);
  assert.deepEqual(plan.duplicates, { carts: [], favorites: [], orderNumbers: [] });
});

test('the counter seed is the highest numeroPedido when there is no counter yet', () => {
  const plan = planIntegrity(clean);

  assert.deepEqual(plan.counter, { current: null, seed: 120 });
});

test('the counter seed never lowers a counter that is already ahead ($max)', () => {
  assert.deepEqual(planIntegrity({ ...clean, counterSeq: 150 }).counter, { current: 150, seed: 150 });
  assert.deepEqual(planIntegrity({ ...clean, counterSeq: 90 }).counter, { current: 90, seed: 120 });
});

test('an empty database seeds 0', () => {
  const plan = planIntegrity({ ...clean, highestOrderNumber: null });

  assert.deepEqual(plan.counter, { current: null, seed: 0 });
});

test('duplicated lists and order numbers are reported and their unique indexes refused', () => {
  const plan = planIntegrity({
    ...clean,
    cartDuplicates: [{ _id: { toString: () => 'u1' }, count: 2, ids: ['c1', 'c2'] }],
    favoriteDuplicates: [{ _id: 'u2', count: 3, ids: ['f1', 'f2', 'f3'] }],
    orderNumberDuplicates: [
      { _id: 7, count: 2, ids: ['p1', 'p2'] },
      { _id: null, count: 4, ids: ['p3', 'p4', 'p5', 'p6'] },
    ],
  });

  assert.deepEqual(plan.duplicates, {
    carts: [{ key: 'u1', count: 2, ids: ['c1', 'c2'] }],
    favorites: [{ key: 'u2', count: 3, ids: ['f1', 'f2', 'f3'] }],
    orderNumbers: [
      { key: 7, count: 2, ids: ['p1', 'p2'] },
      { key: null, count: 4, ids: ['p3', 'p4', 'p5', 'p6'] },
    ],
  });
  assert.deepEqual(plan.indexModels, ['Producto']);
  assert.deepEqual(
    plan.refusals.map(({ model, field, duplicates }) => [model, field, duplicates.length]),
    [
      ['Pedido', 'numeroPedido', 2],
      ['CartItem', 'userId', 1],
      ['Favorite', 'userId', 1],
    ],
  );
  assert.equal(plan.clean, false);
});

test('only the model with duplicates is refused', () => {
  const plan = planIntegrity({ ...clean, favoriteDuplicates: [{ _id: 'u2', count: 2, ids: ['f1', 'f2'] }] });

  assert.deepEqual(plan.indexModels, ['Pedido', 'Producto', 'CartItem']);
  assert.deepEqual(plan.refusals.map((r) => r.model), ['Favorite']);
});
