/**
 * One-off backfill for the DB-driven home (see src/utils/plan-home-backfill.js):
 * marks every active brand/category showOnHome and stores the images of the
 * five home categories while their image is empty. Idempotent.
 *
 * Dry-run by default: prints every planned change, writes nothing.
 * Writes use bulkWrite $set, so the slug pre-validate hook never runs.
 *
 * Uso:
 *   node scripts/backfill-home-taxonomy.js            (dry-run)
 *   node scripts/backfill-home-taxonomy.js --apply    (escribe los cambios)
 *   pnpm backfill:home [-- --apply]
 */

require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');
const Brand = require('../src/models/Brand');
const Category = require('../src/models/Category');
const { planHomeBackfill } = require('../src/utils/plan-home-backfill');

const apply = process.argv.includes('--apply');

const quote = (value) => JSON.stringify(value);

const printPlan = (label, changes) => {
  for (const change of changes) {
    const fields = Object.entries(change.set)
      .map(([field, value]) => `${field}=${quote(value)}`)
      .join(', ');
    console.log(`${label}: ${quote(change.name)} (${change.id}) → ${fields}`);
  }
};

const toOps = (changes) =>
  changes.map((c) => ({ updateOne: { filter: { _id: c.id }, update: { $set: c.set } } }));

const writeChanges = async (Model, changes) => {
  if (changes.length === 0) return 0;
  const result = await Model.bulkWrite(toOps(changes), { ordered: true });
  return result.modifiedCount;
};

const main = async () => {
  await mongoose.connect(config.get('mongo.uri'), config.get('mongo.options'));
  console.log(`Conectado a MongoDB (${apply ? 'APPLY' : 'dry-run'})`);

  const fields = 'name isActive showOnHome image';
  const [brands, categories] = await Promise.all([
    Brand.find({}).select(fields).lean(),
    Category.find({}).select(fields).lean(),
  ]);

  const plan = planHomeBackfill({ brands, categories });

  printPlan('brands', plan.brands);
  printPlan('categories', plan.categories);
  console.log(
    `Resumen: brands ${plan.brands.length} cambio(s); categories ${plan.categories.length} cambio(s)`,
  );

  if (apply) {
    const brandCount = await writeChanges(Brand, plan.brands);
    const categoryCount = await writeChanges(Category, plan.categories);
    console.log(`Escrito: brands ${brandCount}, categories ${categoryCount}`);
  } else {
    console.log('Dry-run: no se escribio nada. Usa --apply para escribir.');
  }

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error('Error en el backfill de la home:', err);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => {});
});
