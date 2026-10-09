const { test, afterEach } = require('node:test');
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
const XLSX = require('xlsx');

const productService = require('../services/product.service');

afterEach(restoreStubs);

// Builds a small .xlsx file in memory, the way an admin would export it from Excel
const workbookBuffer = (rows) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Productos');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const upload = (buffer) =>
  request(app)
    .post('/api/productos/bulk-upload')
    .set(bearer(accessTokenFor(ADMIN_ID)))
    .attach('file', buffer, 'productos.xlsx');

test('bulk upload parses an xlsx file and upserts the normalized rows', async () => {
  stubDefaultUsers();
  const bulkUpsert = stub(
    productService,
    'bulkUpsert',
    spy({ total: 2, upserted: 1, modified: 1, matched: 1 })
  );

  const res = await upload(
    workbookBuffer([
      { Nombre: 'Shampoo', Precio: 1500, Stock: 10, Marca: 'Meguiars' },
      { Nombre: 'Cera', Precio: 3000, Stock: 0, Categoria: 'Ceras' },
      { Nombre: 'Sin precio' },
    ])
  );

  assert.equal(res.status, 200);
  assert.deepEqual(bulkUpsert.calls, [
    [
      [
        { name: 'Shampoo', price: 1500, stock: 10, brand: 'Meguiars' },
        { name: 'Cera', price: 3000, stock: 0, category: 'Ceras' },
      ],
    ],
  ]);
  assert.equal(res.body.data.total, 2);
});

test('bulk upload counts an updated row once (matched already includes modified)', async () => {
  stubDefaultUsers();
  // 1 new row, 2 existing rows of which 1 actually changed
  stub(productService, 'bulkUpsert', spy({ total: 3, upserted: 1, modified: 1, matched: 2 }));

  const res = await upload(
    workbookBuffer([
      { nombre: 'A', precio: 1, stock: 1 },
      { nombre: 'B', precio: 2, stock: 2 },
      { nombre: 'C', precio: 3, stock: 3 },
    ])
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.data.exitosos, 3);
  assert.equal(res.body.data.nuevos, 1);
});

test('bulk upload answers 400 when no row has the required columns', async () => {
  stubDefaultUsers();
  const bulkUpsert = stub(productService, 'bulkUpsert', spy(undefined));

  const res = await upload(workbookBuffer([{ Otra: 'x' }]));

  assert.equal(res.status, 400);
  assert.equal(bulkUpsert.calls.length, 0);
});
