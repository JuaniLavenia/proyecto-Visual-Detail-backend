const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');

const { listProductsQueryValidation, MAX_FILTER_LENGTH } = require('./product.validators');

const validate = async (query) => {
  const req = { query };
  for (const chain of listProductsQueryValidation) {
    await chain.run(req);
  }
  return { req, errors: validationResult(req).array() };
};

test('list query accepts brand, category, search, sort, page and limit together', async () => {
  const { req, errors } = await validate({
    brand: '  toxic-shine ',
    category: 'ceras',
    search: 'shampoo',
    sort: 'price_asc',
    page: '2',
    limit: '12',
  });

  assert.deepEqual(errors, []);
  assert.equal(req.query.brand, 'toxic-shine');
});

test('list query accepts an empty query', async () => {
  const { errors } = await validate({});
  assert.deepEqual(errors, []);
});

test('list query rejects an unknown sort value', async () => {
  const { errors } = await validate({ sort: 'createdAt' });
  assert.deepEqual(errors.map((e) => e.path), ['sort']);
});

test('list query rejects filters longer than the cap', async () => {
  const { errors } = await validate({ search: 'a'.repeat(MAX_FILTER_LENGTH + 1) });
  assert.deepEqual(errors.map((e) => e.path), ['search']);
});

test('list query rejects repeated (array) filter params', async () => {
  const { errors } = await validate({ brand: ['a', 'b'] });
  assert.deepEqual(errors.map((e) => e.path), ['brand']);
});
