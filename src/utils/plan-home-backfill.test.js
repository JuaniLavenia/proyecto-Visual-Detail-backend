const { test } = require('node:test');
const assert = require('node:assert/strict');

const { planHomeBackfill, HOME_CATEGORY_IMAGES } = require('./plan-home-backfill');

const EXTERIORES = HOME_CATEGORY_IMAGES.exteriores;

test('every active entry not yet on the home is marked showOnHome', () => {
  const plan = planHomeBackfill({
    brands: [
      { _id: 'b1', name: 'Toxic Shine', isActive: true },
      { _id: 'b2', name: 'Meguiars', isActive: true, showOnHome: false },
      { _id: 'b3', name: 'Ya en home', isActive: true, showOnHome: true },
      { _id: 'b4', name: 'Inactiva', isActive: false, showOnHome: false },
    ],
  });

  assert.deepEqual(plan.brands, [
    { id: 'b1', name: 'Toxic Shine', set: { showOnHome: true } },
    { id: 'b2', name: 'Meguiars', set: { showOnHome: true } },
  ]);
  assert.deepEqual(plan.categories, []);
});

test('the five home categories get their image, matched ignoring case and accents', () => {
  const plan = planHomeBackfill({
    categories: [
      { _id: 'c1', name: 'Exteriores', isActive: true, showOnHome: true, image: '' },
      { _id: 'c2', name: 'INTERIORES', isActive: true, showOnHome: true },
      { _id: 'c3', name: 'Linea  profesional', isActive: true, showOnHome: true, image: '   ' },
      { _id: 'c4', name: 'Línea Industrial', isActive: true, showOnHome: true, image: '' },
      { _id: 'c5', name: 'perfumes', isActive: true, showOnHome: true, image: '' },
      { _id: 'c6', name: 'Ceras', isActive: true, showOnHome: true, image: '' },
    ],
  });

  assert.deepEqual(
    plan.categories.map((c) => [c.id, c.set.image]),
    [
      ['c1', HOME_CATEGORY_IMAGES.exteriores],
      ['c2', HOME_CATEGORY_IMAGES.interiores],
      ['c3', HOME_CATEGORY_IMAGES['linea profesional']],
      ['c4', HOME_CATEGORY_IMAGES['linea industrial']],
      ['c5', HOME_CATEGORY_IMAGES.perfumes],
    ],
  );
});

test('an existing category image is never overwritten', () => {
  const plan = planHomeBackfill({
    categories: [{ _id: 'c1', name: 'Exteriores', isActive: true, showOnHome: true, image: 'https://mine.example/x.jpg' }],
  });

  assert.deepEqual(plan.categories, []);
});

test('showOnHome and image are planned together for one category', () => {
  const plan = planHomeBackfill({
    categories: [{ _id: 'c1', name: 'Exteriores', isActive: true, image: '' }],
  });

  assert.deepEqual(plan.categories, [
    { id: 'c1', name: 'Exteriores', set: { showOnHome: true, image: EXTERIORES } },
  ]);
});

test('an inactive home category still gets its image but stays off the home', () => {
  const plan = planHomeBackfill({
    categories: [{ _id: 'c1', name: 'Perfumes', isActive: false, showOnHome: false, image: '' }],
  });

  assert.deepEqual(plan.categories, [
    { id: 'c1', name: 'Perfumes', set: { image: HOME_CATEGORY_IMAGES.perfumes } },
  ]);
});

test('applying the plan and planning again changes nothing', () => {
  const brands = [{ _id: 'b1', name: 'Toxic Shine', isActive: true }];
  const categories = [
    { _id: 'c1', name: 'Exteriores', isActive: true, image: '' },
    { _id: 'c2', name: 'Ceras', isActive: true },
  ];

  const first = planHomeBackfill({ brands, categories });
  const apply = (docs, changes) =>
    docs.map((doc) => {
      const change = changes.find((c) => c.id === String(doc._id));
      return change ? { ...doc, ...change.set } : doc;
    });

  const second = planHomeBackfill({
    brands: apply(brands, first.brands),
    categories: apply(categories, first.categories),
  });

  assert.equal(first.brands.length + first.categories.length, 3);
  assert.deepEqual(second, { brands: [], categories: [] });
});

test('the category images are the absolute https URLs of the current home', () => {
  assert.deepEqual(Object.keys(HOME_CATEGORY_IMAGES).sort(), [
    'exteriores',
    'interiores',
    'linea industrial',
    'linea profesional',
    'perfumes',
  ]);
  for (const url of Object.values(HOME_CATEGORY_IMAGES)) {
    assert.match(url, /^https:\/\/static\.wixstatic\.com\/media\//);
  }
});
