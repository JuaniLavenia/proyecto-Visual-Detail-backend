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

const upload = (buffer, filename = 'productos.xlsx') =>
  request(app)
    .post('/api/productos/bulk-upload')
    .set(bearer(accessTokenFor(ADMIN_ID)))
    .attach('file', buffer, filename);

const full = (overrides = {}) => ({
  Nombre: 'Shampoo',
  Precio: 1500,
  Stock: 10,
  Capacidad: '500ml',
  Categoria: 'Lavado',
  Marca: 'Meguiars',
  ...overrides,
});

test('bulk upload parses an xlsx file and upserts the normalized rows', async () => {
  stubDefaultUsers();
  const bulkUpsert = stub(
    productService,
    'bulkUpsert',
    spy({ total: 2, upserted: 1, modified: 1, matched: 1 })
  );

  const res = await upload(
    workbookBuffer([full(), full({ Nombre: 'Cera', Precio: 3000, Stock: 0, Categoria: 'Ceras' })])
  );

  assert.equal(res.status, 200);
  assert.deepEqual(bulkUpsert.calls, [
    [
      [
        { name: 'Shampoo', price: 1500, stock: 10, capacity: '500ml', category: 'Lavado', brand: 'Meguiars' },
        { name: 'Cera', price: 3000, stock: 0, capacity: '500ml', category: 'Ceras', brand: 'Meguiars' },
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
    workbookBuffer([full({ Nombre: 'A' }), full({ Nombre: 'B' }), full({ Nombre: 'C' })])
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.data.exitosos, 3);
  assert.equal(res.body.data.nuevos, 1);
});

test('bulk upload rejects the whole file and lists every row error', async () => {
  stubDefaultUsers();
  const bulkUpsert = stub(productService, 'bulkUpsert', spy(undefined));

  const res = await upload(
    workbookBuffer([full(), full({ Precio: 'consultar' }), full({ Stock: '' })])
  );

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'INVALID_SHEET');
  assert.equal(res.body.error.message, 'La planilla tiene errores. No se importó ningún producto.');
  assert.deepEqual(res.body.error.details, [
    { row: 3, column: 'Precio', message: 'El precio "consultar" no es un número válido (ej: 1500 o 1.500,50)' },
    { row: 4, column: 'Stock', message: 'Falta el stock' },
  ]);
  assert.equal(bulkUpsert.calls.length, 0);
});

test('bulk upload answers 400 with success false when the file has no product rows', async () => {
  stubDefaultUsers();
  const bulkUpsert = stub(productService, 'bulkUpsert', spy(undefined));

  const res = await upload(workbookBuffer([{ Otra: 'x' }]));

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'INVALID_SHEET');
  assert.equal(bulkUpsert.calls.length, 0);
});

test('bulk upload rejects files that are not xlsx, xls or csv', async () => {
  stubDefaultUsers();
  const bulkUpsert = stub(productService, 'bulkUpsert', spy(undefined));

  const res = await upload(Buffer.from('%PDF-1.4'), 'lista.pdf');

  assert.equal(res.status, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: {
      message: 'Formato no soportado. Subí un archivo .xlsx, .xls o .csv',
      code: 'INVALID_FILE_TYPE',
    },
  });
  assert.equal(bulkUpsert.calls.length, 0);
});
