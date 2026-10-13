/**
 * Atomic order numbering: numeroPedido comes from a counter document
 * incremented with $inc, so two concurrent orders never get the same number.
 *
 * The counter is seeded from the highest stored numeroPedido with $max
 * (idempotent, never lowers it), so numbering continues where it was.
 * ensureOrderCounter() runs once after connecting (src/server.js) and from
 * scripts/check-integrity.js; nextOrderNumber() also seeds on its own when the
 * counter is still missing, so the first $inc can never restart at 1 while
 * orders exist.
 */
const Counter = require('../models/Counter');

const ORDER_COUNTER_ID = 'numeroPedido';

const COUNTER_FILTER = Object.freeze({ _id: ORDER_COUNTER_ID });

const highestOrderNumber = async () => {
  // Lazy: the Order model requires this module for its pre-save hook
  const Pedido = require('../models/Order');
  const last = await Pedido.findOne(
    { numeroPedido: { $type: 'number' } },
    { numeroPedido: 1 },
    { sort: { numeroPedido: -1 }, lean: true }
  );
  return last?.numeroPedido ?? 0;
};

/** Seeds the counter with the highest numeroPedido. Resolves to that value. */
const ensureOrderCounter = async () => {
  const highest = await highestOrderNumber();
  await Counter.updateOne({ ...COUNTER_FILTER }, { $max: { seq: highest } }, { upsert: true });
  return highest;
};

const increment = (options) =>
  Counter.findOneAndUpdate({ ...COUNTER_FILTER }, { $inc: { seq: 1 } }, { new: true, ...options });

/** Takes the next order number. */
const nextOrderNumber = async () => {
  const counter = await increment();
  if (counter) return counter.seq;

  // Counter missing: seed it before the increment that may create it
  await ensureOrderCounter();
  const seeded = await increment({ upsert: true });
  return seeded.seq;
};

module.exports = { ORDER_COUNTER_ID, ensureOrderCounter, nextOrderNumber };
