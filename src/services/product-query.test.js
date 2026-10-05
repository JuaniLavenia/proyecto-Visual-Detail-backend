const test = require('node:test');
const assert = require('node:assert/strict');

const { findTaxonomyName, resolveTaxonomyName } = require('./product-query');

const catalog = [
  { name: 'Toxic Shine', slug: 'toxic-shine' },
  { name: 'Línea Profesional', slug: 'linea-profesional' },
  { name: 'Full Car', slug: 'full-car' },
  // Legacy entry whose stored slug no longer matches its name.
  { name: 'Ceras', slug: 'ceras-y-selladores' },
];

test('findTaxonomyName resolves a slug to the canonical name', () => {
  assert.equal(findTaxonomyName('toxic-shine', catalog), 'Toxic Shine');
  assert.equal(findTaxonomyName('linea-profesional', catalog), 'Línea Profesional');
});

test('findTaxonomyName falls back to a case-insensitive exact name match', () => {
  assert.equal(findTaxonomyName('  CERAS ', catalog), 'Ceras');
  assert.equal(findTaxonomyName('línea profesional', catalog), 'Línea Profesional');
});

test('findTaxonomyName prefers the slug match over a name match', () => {
  const ambiguous = [
    { name: 'full-car', slug: 'other' },
    { name: 'Full Car', slug: 'full-car' },
  ];
  assert.equal(findTaxonomyName('full-car', ambiguous), 'Full Car');
});

test('findTaxonomyName does not match partial values', () => {
  assert.equal(findTaxonomyName('car', catalog), null);
  assert.equal(findTaxonomyName('toxic', catalog), null);
});

test('findTaxonomyName returns null for empty or non-string input', () => {
  assert.equal(findTaxonomyName('', catalog), null);
  assert.equal(findTaxonomyName('   ', catalog), null);
  assert.equal(findTaxonomyName(undefined, catalog), null);
  assert.equal(findTaxonomyName(['toxic-shine'], catalog), null);
});

const stubModel = (entries) => {
  const calls = [];
  return {
    calls,
    find(filter) {
      calls.push(filter);
      return { select: () => ({ lean: async () => entries }) };
    },
  };
};

test('resolveTaxonomyName loads the catalog and resolves the value', async () => {
  const Model = stubModel(catalog);
  assert.equal(await resolveTaxonomyName(Model, 'full-car'), 'Full Car');
  assert.equal(Model.calls.length, 1);
});

test('resolveTaxonomyName returns null for an unknown value', async () => {
  assert.equal(await resolveTaxonomyName(stubModel(catalog), 'no-existe'), null);
});

test('resolveTaxonomyName skips the database for an empty value', async () => {
  const Model = stubModel(catalog);
  assert.equal(await resolveTaxonomyName(Model, ''), null);
  assert.equal(Model.calls.length, 0);
});
