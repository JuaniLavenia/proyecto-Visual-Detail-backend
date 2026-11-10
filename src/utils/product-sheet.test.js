const { test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

const { parseProductSheet, isSupportedSheetFile } = require('./product-sheet');

// Builds an .xlsx buffer from an array of rows (arrays of cells), so tests can
// place titles, blank rows and stray notes exactly where a person would.
const xlsx = (rows) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Productos');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const HEADERS = ['nombre', 'precio', 'stock', 'capacidad', 'categoria', 'marca'];
const ROW = ['Shampoo', 1500, 10, '500ml', 'Lavado', 'Meguiars'];

test('finds the header row below a title and reports real spreadsheet row numbers', () => {
  const result = parseProductSheet(
    xlsx([['Lista de precios noviembre'], [], HEADERS, ROW]),
    'productos.xlsx'
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows, [
    {
      row: 4,
      data: {
        name: 'Shampoo',
        price: 1500,
        stock: 10,
        capacity: '500ml',
        category: 'Lavado',
        brand: 'Meguiars',
      },
    },
  ]);
});

test('headers ignore case, accents and spaces, and accept URL/Link for the image', () => {
  const headers = ['NOMBRE', 'Descripción', 'Precio', 'Stock', 'Tamaño', 'Categoría', 'Marca', 'Imagen URL'];
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/a.heic';
  const result = parseProductSheet(
    xlsx([headers, ['Cera', 'Brillo', 3000, 2, '250ml', 'Ceras', 'Sonax', url]]),
    'p.xlsx'
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.headers.category, 'Categoría');
  assert.equal(result.headers.image, 'Imagen URL');
  assert.deepEqual(result.rows[0].data, {
    name: 'Cera',
    description: 'Brillo',
    price: 3000,
    stock: 2,
    capacity: '250ml',
    category: 'Ceras',
    brand: 'Sonax',
    image: url,
  });

  for (const header of ['URL', 'Link']) {
    const parsed = parseProductSheet(xlsx([[...HEADERS, header], [...ROW, url]]), 'p.xlsx');
    assert.equal(parsed.rows[0].data.image, url, header);
  }
});

test('ignores unknown columns, blank rows and rows with only stray notes', () => {
  const result = parseProductSheet(
    xlsx([
      [...HEADERS, 'Notas'],
      [...ROW, 'revisar'],
      [],
      ['', '', '', '', '', '', 'nota suelta'],
    ]),
    'p.xlsx'
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal('Notas' in result.rows[0].data, false);
});

test('a partially filled row reports each missing required field with its row', () => {
  const result = parseProductSheet(
    xlsx([HEADERS, ROW, ['Total', '', '', '', '', '']]),
    'p.xlsx'
  );

  assert.deepEqual(result.errors, [
    { row: 3, column: 'precio', message: 'Falta el precio' },
    { row: 3, column: 'stock', message: 'Falta el stock' },
    { row: 3, column: 'capacidad', message: 'Falta la capacidad' },
    { row: 3, column: 'categoria', message: 'Falta la categoría' },
  ]);
});

test('reads Argentine prices and rejects invalid or negative ones', () => {
  const prices = ['$1.500,50', '1.500', '1500.5', 2000, '$ 1.250.000'];
  const result = parseProductSheet(
    xlsx([HEADERS, ...prices.map((price) => ['P', price, 1, '1l', 'C', 'M'])]),
    'p.xlsx'
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.rows.map((r) => r.data.price),
    [1500.5, 1500, 1500.5, 2000, 1250000]
  );

  const bad = parseProductSheet(
    xlsx([HEADERS, ['P', 'consultar', 1, '1l', 'C', 'M'], ['P', '-5', 1, '1l', 'C', 'M']]),
    'p.xlsx'
  );
  assert.deepEqual(bad.errors, [
    { row: 2, column: 'precio', message: 'El precio "consultar" no es un número válido (ej: 1500 o 1.500,50)' },
    { row: 3, column: 'precio', message: 'El precio no puede ser negativo' },
  ]);
});

test('stock must be a whole number', () => {
  const result = parseProductSheet(xlsx([HEADERS, ['P', 1, 2.5, '1l', 'C', 'M']]), 'p.xlsx');

  assert.deepEqual(result.errors, [
    { row: 2, column: 'stock', message: 'El stock debe ser un número entero' },
  ]);
});

test('the image must be an http(s) link', () => {
  const result = parseProductSheet(
    xlsx([[...HEADERS, 'imagen'], [...ROW, 'res.cloudinary.com/demo/a.jpg']]),
    'p.xlsx'
  );

  assert.deepEqual(result.errors, [
    { row: 2, column: 'imagen', message: 'La imagen debe ser un link que empiece con http:// o https://' },
  ]);
});

test('reads a semicolon CSV saved as UTF-8 and keeps its text as typed', () => {
  const csv = 'Nombre;Precio;Stock;Capacidad;Categoría;Marca\nPulidor Ñandú;1.500,50;3;1l;Pulido;3D\n';
  const result = parseProductSheet(Buffer.from(csv, 'utf8'), 'productos.csv');

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows[0].data, {
    name: 'Pulidor Ñandú',
    price: 1500.5,
    stock: 3,
    capacity: '1l',
    category: 'Pulido',
    brand: '3D',
  });
});

test('reports a missing required column once, for the header row', () => {
  const result = parseProductSheet(
    xlsx([['nombre', 'precio', 'stock', 'categoria'], ['P', 1, 1, 'C']]),
    'p.xlsx'
  );

  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.errors, [
    { row: 1, column: 'capacidad', message: 'Falta la columna obligatoria "capacidad"' },
  ]);
});

test('reports two columns that mean the same field', () => {
  const result = parseProductSheet(
    xlsx([[...HEADERS, 'Imagen', 'Link'], [...ROW, '', '']]),
    'p.xlsx'
  );

  assert.deepEqual(result.errors, [
    { row: 1, column: 'Link', message: 'Las columnas "Imagen" y "Link" son el mismo dato (imagen). Dejá una sola.' },
  ]);
});

test('reports a sheet without a recognizable header row', () => {
  const result = parseProductSheet(xlsx([['hola', 'mundo'], ['a', 'b']]), 'p.xlsx');

  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.errors, [
    {
      row: null,
      column: null,
      message:
        'No se encontraron los encabezados en las primeras 10 filas. Usá la plantilla: nombre, descripcion, imagen, precio, precioMayorista, stock, categoria, capacidad, marca',
    },
  ]);
});

test('only .xlsx, .xls and .csv files are supported', () => {
  assert.equal(isSupportedSheetFile('Productos.XLSX'), true);
  assert.equal(isSupportedSheetFile('viejo.xls'), true);
  assert.equal(isSupportedSheetFile('lista.csv'), true);
  assert.equal(isSupportedSheetFile('lista.pdf'), false);
  assert.equal(isSupportedSheetFile('sin-extension'), false);
});
