const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const Producto = require('../models/Product');
const Brand = require('../models/Brand');
const Category = require('../models/Category');
const productService = require('./product.service');

const catalogStub = (entries) => () => ({ select: () => ({ lean: async () => entries }) });

let received;

beforeEach(() => {
  received = { find: [], count: [] };
  Brand.find = catalogStub([{ name: 'Toxic Shine', slug: 'toxic-shine' }]);
  Category.find = catalogStub([{ name: 'Ceras', slug: 'ceras' }]);

  Producto.find = (filter) => {
    received.find.push(filter);
    const chain = {
      select: () => chain,
      sort: (sort) => {
        received.sort = sort;
        return chain;
      },
      skip: (skip) => {
        received.skip = skip;
        return chain;
      },
      limit: async (limit) => {
        received.limit = limit;
        return [{ name: 'Cera X' }];
      },
    };
    return chain;
  };
  Producto.countDocuments = async (filter) => {
    received.count.push(filter);
    return 13;
  };
});

test('findAll ANDs resolved brand, category and escaped search with the price sort', async () => {
  const result = await productService.findAll({
    page: 2,
    limit: 12,
    brand: 'toxic-shine',
    category: 'CERAS',
    search: 'cera.x',
    sort: 'price_desc',
  });

  const expectedFilter = {
    brand: 'Toxic Shine',
    category: 'Ceras',
    name: { $regex: 'cera\\.x', $options: 'i' },
  };
  assert.deepEqual(received.find, [expectedFilter]);
  assert.deepEqual(received.count, [expectedFilter]);
  assert.deepEqual(received.sort, { price: -1, _id: -1 });
  assert.equal(received.skip, 12);
  assert.equal(received.limit, 12);
  assert.deepEqual(result, {
    products: [{ name: 'Cera X' }],
    currentPage: 2,
    totalPages: 2,
    totalProducts: 13,
  });
});

test('findAll with no filters keeps the export contract and sorts by _id', async () => {
  const result = await productService.findAll({ page: 1, limit: 10000 });

  assert.deepEqual(received.find, [{}]);
  assert.deepEqual(received.sort, { _id: -1 });
  assert.equal(result.totalProducts, 13);
  assert.equal(result.totalPages, 1);
});

test('findAll returns an empty page for an unknown brand without querying products', async () => {
  const result = await productService.findAll({ page: 1, limit: 10, brand: 'no-existe', category: 'ceras' });

  assert.deepEqual(result, { products: [], currentPage: 1, totalPages: 0, totalProducts: 0 });
  assert.equal(received.find.length, 0);
  assert.equal(received.count.length, 0);
});
