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
const { parseProductSheet } = require('../utils/product-sheet');

afterEach(restoreStubs);

// Builds a small .xlsx file in memory, the way an admin would export it from Excel
const workbookBuffer = (rows) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Productos');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const upload = (buffer, filename = 'productos.xlsx', mode) => {
  const req = request(app)
    .post('/api/productos/bulk-upload')
    .set(bearer(accessTokenFor(ADMIN_ID)));
  if (mode !== undefined) req.field('mode', mode);
  return req.attach('file', buffer, filename);
};

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
    spy({ errors: [], total: 2, upserted: 1, modified: 1, matched: 1 })
  );

  const res = await upload(
    workbookBuffer([full(), full({ Nombre: 'Cera', Precio: 3000, Stock: 0, Categoria: 'Ceras' })])
  );

  assert.equal(res.status, 200);
  assert.deepEqual(bulkUpsert.calls, [
    [
      [
        { row: 2, data: { name: 'Shampoo', price: 1500, stock: 10, capacity: '500ml', category: 'Lavado', brand: 'Meguiars' } },
        { row: 3, data: { name: 'Cera', price: 3000, stock: 0, capacity: '500ml', category: 'Ceras', brand: 'Meguiars' } },
      ],
      { name: 'Nombre', price: 'Precio', stock: 'Stock', capacity: 'Capacidad', category: 'Categoria', brand: 'Marca' },
    ],
  ]);
  assert.equal(res.body.data.total, 2);
});

test('bulk upload counts an updated row once (matched already includes modified)', async () => {
  stubDefaultUsers();
  // 1 new row, 2 existing rows of which 1 actually changed
  stub(productService, 'bulkUpsert', spy({ errors: [], total: 3, upserted: 1, modified: 1, matched: 2 }));

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
  stub(productService, 'checkImport', spy([]));

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

test('bulk upload rejects the file when the catalog check finds errors', async () => {
  stubDefaultUsers();
  const errors = [{ row: 2, column: 'Marca', message: 'La marca "X" no existe o no está activa. Creala en el admin o corregí la planilla' }];
  stub(productService, 'bulkUpsert', spy({ errors }));

  const res = await upload(workbookBuffer([full({ Marca: 'X' })]));

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'INVALID_SHEET');
  assert.deepEqual(res.body.error.details, errors);
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

test('bulk upload in replace mode replaces the catalog instead of upserting', async () => {
  stubDefaultUsers();
  const bulkUpsert = stub(productService, 'bulkUpsert', spy(undefined));
  const replaceCatalog = stub(
    productService,
    'replaceCatalog',
    spy({ errors: [], total: 1, deleted: 40, inserted: 1 })
  );

  const res = await upload(workbookBuffer([full()]), 'productos.xlsx', 'replace');

  assert.equal(res.status, 200);
  assert.equal(replaceCatalog.calls.length, 1);
  assert.deepEqual(replaceCatalog.calls[0][0], [
    { row: 2, data: { name: 'Shampoo', price: 1500, stock: 10, capacity: '500ml', category: 'Lavado', brand: 'Meguiars' } },
  ]);
  assert.equal(bulkUpsert.calls.length, 0);
  assert.deepEqual(res.body.data, {
    message: 'Catálogo reemplazado: 40 productos eliminados, 1 cargados',
    modo: 'replace',
    total: 1,
    eliminados: 40,
    nuevos: 1,
  });
});

test('bulk upload in replace mode rejects the file when a row is invalid', async () => {
  stubDefaultUsers();
  const errors = [{ row: 2, column: 'Marca', message: 'x' }];
  stub(productService, 'replaceCatalog', spy({ errors }));

  const res = await upload(workbookBuffer([full()]), 'productos.xlsx', 'replace');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_SHEET');
  assert.equal(res.body.error.message, 'La planilla tiene errores. No se modificó el catálogo.');
  assert.deepEqual(res.body.error.details, errors);
});

test('bulk upload rejects an unknown mode before reading the file', async () => {
  stubDefaultUsers();
  const replaceCatalog = stub(productService, 'replaceCatalog', spy(undefined));
  const bulkUpsert = stub(productService, 'bulkUpsert', spy(undefined));

  const res = await upload(workbookBuffer([full()]), 'productos.xlsx', 'borrar');

  assert.equal(res.status, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: { message: 'Modo de importación inválido. Usá "upsert" o "replace"', code: 'INVALID_MODE' },
  });
  assert.equal(replaceCatalog.calls.length + bulkUpsert.calls.length, 0);
});

test('bulk upload without a mode keeps upserting (previous behavior)', async () => {
  stubDefaultUsers();
  const bulkUpsert = stub(productService, 'bulkUpsert', spy({ errors: [], total: 1, upserted: 1, modified: 0, matched: 0 }));
  const replaceCatalog = stub(productService, 'replaceCatalog', spy(undefined));

  const res = await upload(workbookBuffer([full()]));

  assert.equal(res.status, 200);
  assert.equal(bulkUpsert.calls.length, 1);
  assert.equal(replaceCatalog.calls.length, 0);
  assert.equal(res.body.data.modo, 'upsert');
});

test('the import template is an xlsx with only the template headers, and it parses back', async () => {
  stubDefaultUsers();

  const res = await request(app)
    .get('/api/productos/template')
    .set(bearer(accessTokenFor(ADMIN_ID)))
    .buffer(true)
    .parse((response, done) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => done(null, Buffer.concat(chunks)));
    });

  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(res.headers['content-disposition'], 'attachment; filename=plantilla-productos.xlsx');

  const workbook = XLSX.read(res.body, { type: 'buffer' });
  const grid = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  assert.deepEqual(grid, [
    ['nombre', 'descripcion', 'imagen', 'precio', 'precioMayorista', 'stock', 'categoria', 'capacidad', 'marca'],
  ]);

  const parsed = parseProductSheet(res.body, 'plantilla-productos.xlsx');
  assert.deepEqual(parsed.errors, []);
  assert.equal(Object.keys(parsed.headers).length, 9);
});

test('bulk upload reports format and catalog errors of the same sheet together, sorted by row', async () => {
  stubDefaultUsers();
  const bulkUpsert = stub(productService, 'bulkUpsert', spy(undefined));
  const checkImport = stub(
    productService,
    'checkImport',
    spy([{ row: 2, column: 'Marca', message: 'La marca "X" no existe o no está activa. Creala en el admin o corregí la planilla' }])
  );

  const res = await upload(workbookBuffer([full({ Marca: 'X' }), full({ Precio: 'consultar' })]));

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_SHEET');
  assert.deepEqual(res.body.error.details, [
    { row: 2, column: 'Marca', message: 'La marca "X" no existe o no está activa. Creala en el admin o corregí la planilla' },
    { row: 3, column: 'Precio', message: 'El precio "consultar" no es un número válido (ej: 1500 o 1.500,50)' },
  ]);
  // Only the rows that passed the format checks reach the catalog checks
  assert.equal(checkImport.calls.length, 1);
  const [rows, headers, mode] = checkImport.calls[0];
  assert.deepEqual(rows.map((r) => r.row), [2]);
  assert.equal(headers.brand, 'Marca');
  assert.equal(mode, 'upsert');
  assert.equal(bulkUpsert.calls.length, 0);
});

test('bulk upload in replace mode also reports both kinds of errors and replaces nothing', async () => {
  stubDefaultUsers();
  const replaceCatalog = stub(productService, 'replaceCatalog', spy(undefined));
  const checkImport = stub(productService, 'checkImport', spy([]));

  const res = await upload(workbookBuffer([full(), full({ Stock: '' })]), 'productos.xlsx', 'replace');

  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'La planilla tiene errores. No se modificó el catálogo.');
  assert.deepEqual(res.body.error.details, [{ row: 3, column: 'Stock', message: 'Falta el stock' }]);
  assert.equal(checkImport.calls[0][2], 'replace');
  assert.equal(replaceCatalog.calls.length, 0);
});

test('export leaves the image empty when it is not a link, so the file re-imports', async () => {
  stubDefaultUsers();
  const product = { price: 10, stock: 1, category: 'Ceras', capacity: '1L', brand: 'Sonax' };
  stub(
    productService,
    'findAll',
    spy({
      products: [
        { ...product, name: 'Vieja', image: '1683676311747-Coffe.png' },
        { ...product, name: 'Nueva', image: 'https://res.cloudinary.com/demo/image/upload/v1/a.heic' },
        { ...product, name: 'Sin foto' },
      ],
    })
  );

  const res = await request(app)
    .get('/api/productos/export')
    .set(bearer(accessTokenFor(ADMIN_ID)))
    .buffer(true)
    .parse((response, done) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => done(null, Buffer.concat(chunks)));
    });

  assert.equal(res.status, 200);
  const parsed = parseProductSheet(res.body, 'productos.xlsx');
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    parsed.rows.map(({ data }) => [data.name, data.image]),
    [['Vieja', undefined], ['Nueva', 'https://res.cloudinary.com/demo/image/upload/v1/a.heic'], ['Sin foto', undefined]]
  );
});
