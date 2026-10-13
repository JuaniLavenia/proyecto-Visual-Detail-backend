/**
 * Production integrity check before deploying the data-integrity indexes
 * (see src/utils/plan-integrity.js).
 *
 * Dry-run by default: reports users with more than one cart, users with more
 * than one favorites document, duplicated numeroPedido and the value the
 * numeroPedido counter would be seeded with. Writes nothing.
 *
 * --apply seeds the counter ($max, idempotent) and builds the schema indexes
 * (syncIndexes) of Pedido, Producto, CartItem and Favorite. A model whose
 * unique index has duplicates is refused and its duplicates are listed; the
 * script never merges or deletes documents. syncIndexes also drops indexes of
 * those collections that the schema does not declare.
 *
 * Uso:
 *   node scripts/check-integrity.js            (dry-run)
 *   node scripts/check-integrity.js --apply    (siembra el contador y construye los indices)
 *   pnpm check:integrity [-- --apply]
 */

require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config');
const Pedido = require('../src/models/Order');
const Producto = require('../src/models/Product');
const CartItem = require('../src/models/Cart');
const Favorite = require('../src/models/Favorite');
const Counter = require('../src/models/Counter');
const { ORDER_COUNTER_ID, highestOrderNumber, ensureOrderCounter } = require('../src/services/order-counter');
const { planIntegrity } = require('../src/utils/plan-integrity');

const apply = process.argv.includes('--apply');

const MODELS = { Pedido, Producto, CartItem, Favorite };

const duplicatesBy = (Model, field) =>
  Model.aggregate([
    { $group: { _id: `$${field}`, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);

const printDuplicates = (plan) => {
  for (const dup of plan.duplicates.carts) {
    console.log(`carts: usuario ${dup.key} tiene ${dup.count} carritos (${dup.ids.join(', ')})`);
  }
  for (const dup of plan.duplicates.favorites) {
    console.log(`favorites: usuario ${dup.key} tiene ${dup.count} documentos de favoritos (${dup.ids.join(', ')})`);
  }
  for (const dup of plan.duplicates.orderNumbers) {
    const label = dup.key === null ? 'sin numero' : dup.key;
    console.log(`pedidos: numeroPedido ${label} repetido en ${dup.count} pedidos (${dup.ids.join(', ')})`);
  }
};

const main = async () => {
  await mongoose.connect(config.get('mongo.uri'), config.get('mongo.options'));
  console.log(`Conectado a MongoDB (${apply ? 'APPLY' : 'dry-run'})`);

  const [cartDuplicates, favoriteDuplicates, orderNumberDuplicates, highest, counter] = await Promise.all([
    duplicatesBy(CartItem, 'userId'),
    duplicatesBy(Favorite, 'userId'),
    duplicatesBy(Pedido, 'numeroPedido'),
    highestOrderNumber(),
    Counter.findById(ORDER_COUNTER_ID).lean(),
  ]);

  const plan = planIntegrity({
    cartDuplicates,
    favoriteDuplicates,
    orderNumberDuplicates,
    highestOrderNumber: highest,
    counterSeq: counter?.seq,
  });

  printDuplicates(plan);
  const current = plan.counter.current === null ? 'sin contador' : plan.counter.current;
  console.log(`contador numeroPedido: actual ${current}, ultimo pedido ${highest}, se siembra en ${plan.counter.seed}`);

  console.log(
    `Resumen: ${plan.duplicates.carts.length} usuario(s) con carritos duplicados; ` +
      `${plan.duplicates.favorites.length} usuario(s) con favoritos duplicados; ` +
      `${plan.duplicates.orderNumbers.length} numeroPedido repetido(s)`,
  );

  if (apply) {
    await ensureOrderCounter();
    console.log(`Contador numeroPedido sembrado (${plan.counter.seed})`);

    for (const refusal of plan.refusals) {
      const keys = refusal.duplicates.map((dup) => (dup.key === null ? 'sin numero' : dup.key)).join(', ');
      console.log(
        `${refusal.model}: NO se construyen los indices, hay duplicados de ${refusal.field}: ${keys}`,
      );
    }
    for (const name of plan.indexModels) {
      const dropped = await MODELS[name].syncIndexes();
      const note = dropped.length ? ` (eliminados: ${dropped.join(', ')})` : '';
      console.log(`${name}: indices sincronizados${note}`);
    }
    if (!plan.clean) {
      console.log('Hay duplicados: resolvelos y volve a correr --apply. No se borro ni se fusiono nada.');
      process.exitCode = 1;
    }
  } else {
    console.log('Dry-run: no se escribio nada. Usa --apply para escribir.');
  }

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error('Error verificando la integridad:', err);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => {});
});
