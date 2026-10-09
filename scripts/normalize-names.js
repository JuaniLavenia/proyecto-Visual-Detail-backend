/**
 * One-off normalization of existing product, brand and category names
 * (same rule as the API: src/utils/normalize-name.js). Product brand and
 * category fields follow the brand/category renames so filters keep matching.
 *
 * Dry-run by default: prints every change and the collisions, writes nothing.
 * Brand/category names are unique: a name that would collide with another
 * doc is reported and skipped, never written. Slugs are not touched.
 *
 * Uso:
 *   node scripts/normalize-names.js            (dry-run)
 *   node scripts/normalize-names.js --apply    (escribe los cambios)
 *   pnpm normalize:names [-- --apply]
 */

require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');
const Brand = require('../src/models/Brand');
const Category = require('../src/models/Category');
const Producto = require('../src/models/Product');
const { planNameChanges } = require('../src/utils/plan-name-changes');

const apply = process.argv.includes('--apply');

const quote = (value) => JSON.stringify(value);

const printTaxonomyPlan = (label, plan) => {
  for (const change of plan.changes) {
    console.log(`${label}: ${quote(change.from)} → ${quote(change.to)}`);
  }
  for (const collision of plan.collisions) {
    const names = collision.docs.map((d) => `${quote(d.name)} (${d.id})`).join(', ');
    console.log(`${label}: COLISION en ${quote(collision.name)}, se omite: ${names}`);
  }
};

const printProductPlan = (plan) => {
  for (const change of plan.changes) {
    for (const field of Object.keys(change.set)) {
      console.log(`products.${field}: ${quote(change.from[field])} → ${quote(change.set[field])} (${change.id})`);
    }
  }
};

// updateOne with $set (not save) so the slug pre-validate hook never runs.
const writeChanges = async (Model, ops) => {
  if (ops.length === 0) return 0;
  const result = await Model.bulkWrite(ops, { ordered: true });
  return result.modifiedCount;
};

const toNameOps = (changes) =>
  changes.map((c) => ({ updateOne: { filter: { _id: c.id }, update: { $set: { name: c.to } } } }));

const toProductOps = (changes) =>
  changes.map((c) => ({ updateOne: { filter: { _id: c.id }, update: { $set: c.set } } }));

const main = async () => {
  await mongoose.connect(config.get('mongo.uri'), config.get('mongo.options'));
  console.log(`Conectado a MongoDB (${apply ? 'APPLY' : 'dry-run'})`);

  const [brands, categories, products] = await Promise.all([
    Brand.find({}).select('name').lean(),
    Category.find({}).select('name').lean(),
    Producto.find({}).select('name brand category').lean(),
  ]);

  const plan = planNameChanges({ products, brands, categories });

  printTaxonomyPlan('brands', plan.brands);
  printTaxonomyPlan('categories', plan.categories);
  printProductPlan(plan.products);

  console.log(
    `Resumen: brands ${plan.brands.changes.length} cambio(s) / ${plan.brands.collisions.length} colision(es); ` +
      `categories ${plan.categories.changes.length} cambio(s) / ${plan.categories.collisions.length} colision(es); ` +
      `products ${plan.products.changes.length} documento(s) a cambiar`,
  );

  if (apply) {
    // Taxonomy first: products only point at names that already exist
    const brandCount = await writeChanges(Brand, toNameOps(plan.brands.changes));
    const categoryCount = await writeChanges(Category, toNameOps(plan.categories.changes));
    const productCount = await writeChanges(Producto, toProductOps(plan.products.changes));
    console.log(`Escrito: brands ${brandCount}, categories ${categoryCount}, products ${productCount}`);
  } else {
    console.log('Dry-run: no se escribio nada. Usa --apply para escribir.');
  }

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error('Error normalizando nombres:', err);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => {});
});
