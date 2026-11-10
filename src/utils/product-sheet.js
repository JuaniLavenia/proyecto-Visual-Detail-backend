/**
 * Reads a product spreadsheet (.xlsx, .xls or .csv) into product rows.
 *
 * The sheet is treated as a table somewhere near the top: the header row is
 * found within the first rows, unknown columns are ignored, and rows whose
 * required fields are all empty (blank rows, stray notes) are skipped. Every
 * other problem becomes an error with the spreadsheet row number, so the admin
 * can fix the file. Callers decide what to do with the errors; this module
 * never touches the database.
 */
const path = require('path');
const XLSX = require('xlsx');
const { isHttpUrlOrEmpty } = require('./image-url');

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const HEADER_SCAN_ROWS = 10;

// `label` is the template header and the column name used in messages.
// `noun` is the field with its article, for "Falta el precio".
const FIELDS = {
  name: {
    label: 'nombre',
    noun: 'el nombre',
    type: 'text',
    required: true,
    aliases: ['name', 'nombre', 'producto', 'product', 'titulo', 'title', 'denominacion'],
  },
  description: {
    label: 'descripcion',
    noun: 'la descripción',
    type: 'text',
    aliases: ['description', 'descripcion', 'desc', 'detalle', 'details', 'detalles'],
  },
  image: {
    label: 'imagen',
    noun: 'la imagen',
    type: 'url',
    aliases: ['image', 'imagen', 'foto', 'photo', 'url', 'link', 'enlace', 'url imagen', 'imagen url'],
  },
  price: {
    label: 'precio',
    noun: 'el precio',
    type: 'amount',
    required: true,
    aliases: ['price', 'precio', 'cost', 'costo', 'valor'],
  },
  precioMayorista: {
    label: 'precioMayorista',
    noun: 'el precio mayorista',
    type: 'amount',
    aliases: ['precioMayorista', 'precio mayorista', 'mayorista', 'wholesale', 'wholesale price'],
  },
  stock: {
    label: 'stock',
    noun: 'el stock',
    type: 'integer',
    required: true,
    aliases: ['stock', 'cantidad', 'quantity', 'disponible', 'available'],
  },
  category: {
    label: 'categoria',
    noun: 'la categoría',
    type: 'text',
    required: true,
    aliases: ['category', 'categoria', 'cat', 'tipo', 'type', 'clase'],
  },
  capacity: {
    label: 'capacidad',
    noun: 'la capacidad',
    type: 'text',
    required: true,
    aliases: ['capacity', 'capacidad', 'volumen', 'volume', 'size', 'tamano', 'tamanio'],
  },
  brand: {
    label: 'marca',
    noun: 'la marca',
    type: 'text',
    aliases: ['brand', 'marca', 'fabricante', 'manufacturer', 'marca comercial'],
  },
};

// Template order: what the export writes and what errors suggest
const TEMPLATE_HEADERS = [
  'nombre',
  'descripcion',
  'imagen',
  'precio',
  'precioMayorista',
  'stock',
  'categoria',
  'capacidad',
  'marca',
];

// "Categoría", " CATEGORIA " and "Imagen_URL" all compare equal
const headerKey = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const FIELD_BY_HEADER = new Map(
  Object.entries(FIELDS).flatMap(([field, { aliases }]) =>
    aliases.map((alias) => [headerKey(alias), field])
  )
);

const REQUIRED_FIELDS = Object.keys(FIELDS).filter((field) => FIELDS[field].required);

const isSupportedSheetFile = (filename) =>
  SUPPORTED_EXTENSIONS.includes(path.extname(String(filename ?? '')).toLowerCase());

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const cleanText = (value) => String(value).trim().replace(/\s+/g, ' ');

/**
 * Argentine amounts: "1500", "1.500", "1.500,50", "$ 1.250.000" and "1500.5".
 * A single dot followed by one or two digits is a decimal point; dots
 * grouping three digits are thousands separators.
 */
const parseAmount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;

  const text = String(value).replace(/[$\s ]/g, '');
  const negative = text.startsWith('-');
  const digits = negative ? text.slice(1) : text;
  let amount = NaN;

  if (/^\d+$/.test(digits)) {
    amount = Number(digits);
  } else if (/^(\d{1,3}(\.\d{3})+|\d+),\d+$/.test(digits)) {
    amount = Number(digits.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d{1,3}(\.\d{3})+$/.test(digits)) {
    amount = Number(digits.replace(/\./g, ''));
  } else if (/^\d+\.\d{1,2}$/.test(digits)) {
    amount = Number(digits);
  }

  return negative ? -amount : amount;
};

// Returns { value } or { error } for one non-blank cell
const parseCell = (field, raw) => {
  const { type, noun } = FIELDS[field];
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  if (type === 'text') return { value: cleanText(raw) };

  if (type === 'url') {
    const url = String(raw).trim();
    return isHttpUrlOrEmpty(url) && /^https?:\/\//i.test(url)
      ? { value: url }
      : { error: `${Noun} debe ser un link que empiece con http:// o https://` };
  }

  const amount = parseAmount(raw);
  if (Number.isNaN(amount)) {
    return { error: `${Noun} "${String(raw).trim()}" no es un número válido (ej: 1500 o 1.500,50)` };
  }
  if (amount < 0) return { error: `${Noun} no puede ser negativo` };
  if (type === 'integer' && !Number.isInteger(amount)) {
    return { error: `${Noun} debe ser un número entero` };
  }
  return { value: amount };
};

const readGrid = (buffer, filename) => {
  const isCsv = path.extname(filename).toLowerCase() === '.csv';
  // CSV is decoded as UTF-8 (accents survive) and kept as text (raw) so
  // "1.500" is not read as 1.5 before parseAmount sees it.
  const workbook = isCsv
    ? XLSX.read(buffer.toString('utf8').replace(/^﻿/, ''), { type: 'string', raw: true })
    : XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet || !sheet['!ref']) return { grid: [], firstRow: 1 };

  const firstRow = XLSX.utils.decode_range(sheet['!ref']).s.r + 1;
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true, raw: true });
  return { grid, firstRow };
};

// The header row is the one, among the first rows, naming the most fields
const findHeader = (grid) => {
  let best = null;
  grid.slice(0, HEADER_SCAN_ROWS).forEach((cells, index) => {
    const matched = cells.filter((cell) => FIELD_BY_HEADER.has(headerKey(cell))).length;
    if (matched >= 2 && (!best || matched > best.matched)) best = { index, matched };
  });
  return best?.index ?? null;
};

/**
 * @param {Buffer} buffer - the uploaded file
 * @param {string} filename - its original name; the extension picks the reader
 * @returns {{ rows: Array<{row: number, data: object}>,
 *             headers: Object<string, string>,
 *             errors: Array<{row: number|null, column: string|null, message: string}> }}
 *   `headers` maps each field to the header text this sheet used for it.
 */
const parseProductSheet = (buffer, filename) => {
  const { grid, firstRow } = readGrid(buffer, filename);
  const headerIndex = findHeader(grid);

  if (headerIndex === null) {
    return {
      rows: [],
      headers: {},
      errors: [
        {
          row: null,
          column: null,
          message: `No se encontraron los encabezados en las primeras ${HEADER_SCAN_ROWS} filas. Usá la plantilla: ${TEMPLATE_HEADERS.join(', ')}`,
        },
      ],
    };
  }

  const headerRow = firstRow + headerIndex;
  const errors = [];
  // field -> { index, header } for the columns this sheet uses
  const columns = new Map();

  grid[headerIndex].forEach((cell, index) => {
    const field = FIELD_BY_HEADER.get(headerKey(cell));
    if (!field) return;
    const header = String(cell).trim();
    const previous = columns.get(field);
    if (previous) {
      errors.push({
        row: headerRow,
        column: header,
        message: `Las columnas "${previous.header}" y "${header}" son el mismo dato (${FIELDS[field].label}). Dejá una sola.`,
      });
      return;
    }
    columns.set(field, { index, header });
  });

  for (const field of REQUIRED_FIELDS) {
    if (!columns.has(field)) {
      errors.push({
        row: headerRow,
        column: FIELDS[field].label,
        message: `Falta la columna obligatoria "${FIELDS[field].label}"`,
      });
    }
  }

  const headers = Object.fromEntries([...columns].map(([field, { header }]) => [field, header]));
  if (errors.length > 0) return { rows: [], headers, errors };

  const rows = [];
  grid.slice(headerIndex + 1).forEach((cells, offset) => {
    const row = headerRow + 1 + offset;
    const cell = (field) => cells[columns.get(field)?.index];

    if (REQUIRED_FIELDS.every((field) => isBlank(cell(field)))) return;

    const data = {};
    let valid = true;
    for (const [field, { index, header }] of columns) {
      const raw = cells[index];
      if (isBlank(raw)) {
        if (FIELDS[field].required) {
          errors.push({ row, column: header, message: `Falta ${FIELDS[field].noun}` });
          valid = false;
        }
        continue;
      }
      const parsed = parseCell(field, raw);
      if (parsed.error) {
        errors.push({ row, column: header, message: parsed.error });
        valid = false;
      } else {
        data[field] = parsed.value;
      }
    }
    if (valid) rows.push({ row, data });
  });

  return { rows, headers, errors };
};

module.exports = {
  parseProductSheet,
  isSupportedSheetFile,
  SUPPORTED_EXTENSIONS,
  TEMPLATE_HEADERS,
};
