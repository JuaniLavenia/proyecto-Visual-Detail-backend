const { test } = require('node:test');
const assert = require('node:assert/strict');

const { planNameChanges, planUniqueNameChanges } = require('./plan-name-changes');

const doc = (id, name, extra = {}) => ({ _id: id, name, ...extra });

test('planUniqueNameChanges lists only names that change', () => {
  const plan = planUniqueNameChanges([doc('1', ' toxic   shine'), doc('2', 'Meguiars'), doc('3', 'ámbar')]);

  assert.deepEqual(plan.changes, [
    { id: '1', from: ' toxic   shine', to: 'Toxic shine' },
    { id: '3', from: 'ámbar', to: 'Ámbar' },
  ]);
  assert.deepEqual(plan.collisions, []);
});

test('planUniqueNameChanges reports and skips a target equal to an existing name', () => {
  const plan = planUniqueNameChanges([doc('1', 'Drop'), doc('2', 'drop')]);

  assert.deepEqual(plan.changes, []);
  assert.deepEqual(plan.collisions, [
    { name: 'Drop', docs: [{ id: '1', name: 'Drop' }, { id: '2', name: 'drop' }] },
  ]);
});

test('planUniqueNameChanges reports two docs that normalize to the same name', () => {
  const plan = planUniqueNameChanges([doc('1', 'fullcar'), doc('2', ' fullcar '), doc('3', 'vonixx')]);

  assert.deepEqual(plan.changes, [{ id: '3', from: 'vonixx', to: 'Vonixx' }]);
  assert.deepEqual(plan.collisions, [
    { name: 'Fullcar', docs: [{ id: '1', name: 'fullcar' }, { id: '2', name: ' fullcar ' }] },
  ]);
});

test('planUniqueNameChanges ignores docs without a string name', () => {
  assert.deepEqual(planUniqueNameChanges([doc('1', undefined), doc('2', null)]), { changes: [], collisions: [] });
});

test('planNameChanges normalizes product names; duplicate product names are allowed', () => {
  const plan = planNameChanges({
    products: [doc('p1', 'cera  x'), doc('p2', 'Cera x'), doc('p3', ' cera x ')],
  });

  assert.deepEqual(plan.products.changes, [
    { id: 'p1', from: { name: 'cera  x' }, set: { name: 'Cera x' } },
    { id: 'p3', from: { name: ' cera x ' }, set: { name: 'Cera x' } },
  ]);
});

test('planNameChanges moves product brand/category along with applied taxonomy renames', () => {
  const plan = planNameChanges({
    brands: [doc('b1', 'toxic shine'), doc('b2', 'Drop'), doc('b3', 'drop')],
    categories: [doc('c1', 'ceras')],
    products: [
      doc('p1', 'Cera', { brand: 'toxic shine', category: 'ceras' }),
      // collided brand: the product keeps pointing at the doc it names
      doc('p2', 'Pad', { brand: 'drop', category: 'ceras' }),
      // names no taxonomy entry and normalizes to none: kept as is
      doc('p3', 'Otro', { brand: 'sin marca', category: 'Ceras' }),
    ],
  });

  assert.deepEqual(plan.brands.changes, [{ id: 'b1', from: 'toxic shine', to: 'Toxic shine' }]);
  assert.equal(plan.brands.collisions.length, 1);
  assert.deepEqual(plan.products.changes, [
    { id: 'p1', from: { brand: 'toxic shine', category: 'ceras' }, set: { brand: 'Toxic shine', category: 'Ceras' } },
    { id: 'p2', from: { category: 'ceras' }, set: { category: 'Ceras' } },
  ]);
});

test('planNameChanges points a product at an already renamed entry (re-run after a partial apply)', () => {
  const plan = planNameChanges({
    brands: [doc('b1', 'Toxic shine')],
    products: [doc('p1', 'Cera', { brand: 'toxic shine' })],
  });

  assert.deepEqual(plan.brands.changes, []);
  assert.deepEqual(plan.products.changes, [
    { id: 'p1', from: { brand: 'toxic shine' }, set: { brand: 'Toxic shine' } },
  ]);
});

test('planNameChanges is a no-op on already normalized data', () => {
  const plan = planNameChanges({
    brands: [doc('b1', 'Toxic Shine')],
    categories: [doc('c1', 'Ceras')],
    products: [doc('p1', 'KIT PARA llantas', { brand: 'Toxic Shine', category: 'Ceras' })],
  });

  assert.deepEqual(plan, {
    brands: { changes: [], collisions: [] },
    categories: { changes: [], collisions: [] },
    products: { changes: [] },
  });
});
