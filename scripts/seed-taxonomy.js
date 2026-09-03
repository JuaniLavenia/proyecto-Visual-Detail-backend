/**
 * Seed inicial de Brand/Category.
 *
 * product.service.js valida brand/category contra estas colecciones en
 * cada alta/edicion de producto. Sin este seed, esas colecciones quedan
 * vacias y CUALQUIER alta/edicion de producto falla con 400
 * TAXONOMY_INVALID, incluso usando las opciones "por defecto" que
 * todavia muestra el formulario del admin.
 *
 * Idempotente: se puede correr mas de una vez, no duplica por nombre.
 *
 * Uso:
 *   node scripts/seed-taxonomy.js
 *   pnpm seed:taxonomy
 */

require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');
const Brand = require('../src/models/Brand');
const Category = require('../src/models/Category');
const Producto = require('../src/models/Product');
const { normalizeTaxonomyLookup } = require('../src/services/product.service');

// Debe reflejar los mismos arrays hardcodeados en
// proyecto-Visual-Detail/src/pages/admin/Products/{ProductCreate,ProductEdit}.jsx
// para que el fallback del formulario siga siendo seleccionable el dia 1.
const DEFAULT_BRANDS = [
  'Toxic-Shine',
  'Fullcar',
  'Dreams',
  'Ternnova',
  'Drop',
  'Menzerna',
  'Meguiars',
  'Vonixx',
  'Laffitte',
  'Stretch',
  'Otros',
];

const DEFAULT_CATEGORIES = [
  'Interiores',
  'Exteriores',
  'Línea Profesional',
  'Línea Industrial',
  'Perfumes y Aromatizantes',
  'Pads y Baking Plates',
  'Microfibras',
  'Aplicadores',
  'Cepillos y Brochas',
  'Dosificadores y Foams',
  'Otros',
];

// Combina los defaults del front con los valores reales que ya usan los
// productos existentes, sin duplicar por acentos/mayusculas/guiones
// (misma normalizacion que usa la validacion de taxonomia en runtime).
// Los defaults ganan el desempate de formato de texto.
const buildNameList = (defaults, existingValues) => {
  const byLookup = new Map();

  for (const raw of defaults) {
    const name = String(raw || '').trim();
    if (!name) continue;
    byLookup.set(normalizeTaxonomyLookup(name), name);
  }

  for (const raw of existingValues) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const key = normalizeTaxonomyLookup(name);
    if (!byLookup.has(key)) {
      byLookup.set(key, name);
    }
  }

  return Array.from(byLookup.values());
};

const upsertTaxonomy = async (Model, names, label) => {
  let created = 0;
  let skipped = 0;

  for (const name of names) {
    const exists = await Model.findOne({ name });
    if (exists) {
      skipped += 1;
      continue;
    }
    await Model.create({ name, isActive: true });
    created += 1;
  }

  console.log(`${label}: ${created} creado(s), ${skipped} ya existian`);
};

const main = async () => {
  await mongoose.connect(config.get('mongo.uri'), config.get('mongo.options'));
  console.log('Conectado a MongoDB');

  const [existingBrandValues, existingCategoryValues] = await Promise.all([
    Producto.distinct('brand'),
    Producto.distinct('category'),
  ]);

  const brandNames = buildNameList(DEFAULT_BRANDS, existingBrandValues);
  const categoryNames = buildNameList(DEFAULT_CATEGORIES, existingCategoryValues);

  await upsertTaxonomy(Brand, brandNames, 'Marcas');
  await upsertTaxonomy(Category, categoryNames, 'Categorias');

  await mongoose.disconnect();
  console.log('Listo.');
};

main().catch((err) => {
  console.error('Error corriendo el seed de taxonomia:', err);
  process.exitCode = 1;
});
