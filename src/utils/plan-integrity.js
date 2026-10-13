/**
 * Pure planning for scripts/check-integrity.js: which duplicates block the
 * unique indexes, which models can build their indexes and the value the
 * numeroPedido counter would be seeded with.
 *
 * Input comes from the script's aggregations ({ _id, count, ids } groups with
 * count > 1) and lookups. Nothing here merges or deletes data: a model whose
 * unique index has duplicates is refused and its duplicates are listed.
 */

// Models whose schema indexes the script builds, in build order
const INDEXED_MODELS = Object.freeze(['Pedido', 'Producto', 'CartItem', 'Favorite']);

const toDuplicates = (groups = []) =>
  groups.map((group) => ({
    key: group._id == null ? null : typeof group._id === 'number' ? group._id : String(group._id),
    count: group.count,
    ids: (group.ids ?? []).map(String),
  }));

const planIntegrity = ({
  cartDuplicates,
  favoriteDuplicates,
  orderNumberDuplicates,
  highestOrderNumber,
  counterSeq,
} = {}) => {
  const duplicates = {
    carts: toDuplicates(cartDuplicates),
    favorites: toDuplicates(favoriteDuplicates),
    orderNumbers: toDuplicates(orderNumberDuplicates),
  };

  const refusals = [
    { model: 'Pedido', field: 'numeroPedido', duplicates: duplicates.orderNumbers },
    { model: 'CartItem', field: 'userId', duplicates: duplicates.carts },
    { model: 'Favorite', field: 'userId', duplicates: duplicates.favorites },
  ].filter((refusal) => refusal.duplicates.length > 0);

  const refused = new Set(refusals.map((refusal) => refusal.model));
  const current = typeof counterSeq === 'number' ? counterSeq : null;

  return {
    duplicates,
    counter: { current, seed: Math.max(current ?? 0, highestOrderNumber ?? 0) },
    indexModels: INDEXED_MODELS.filter((name) => !refused.has(name)),
    refusals,
    clean: refusals.length === 0,
  };
};

module.exports = { planIntegrity, INDEXED_MODELS };
