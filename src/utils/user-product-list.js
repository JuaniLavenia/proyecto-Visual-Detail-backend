/**
 * Loads a user's product list (cart or favorites) with its products populated.
 * Never returns null: a user without a document gets an empty list, and items
 * whose product no longer exists (populate returned null) are left out.
 */
const loadUserProducts = async (Model, userId) => {
  const list = await Model.findOne({ userId }).populate('products.product');
  const products = list?.products ?? [];
  return products.filter((item) => item.product != null);
};

const isDuplicateKeyError = (err) => err?.code === 11000;

/**
 * Atomically creates the user's list holding only `item`, unless the user
 * already has one (unique index on userId). Resolves to true when this call
 * created it, false when a list already existed or a concurrent first add won
 * the race (duplicate key): the caller then updates the existing list instead.
 */
const createListIfMissing = async (Model, userId, item) => {
  // Same validation (and errors) as saving a new document; the upsert then
  // writes the already cast items
  const draft = new Model({ userId, products: [item] });
  await draft.validate();
  const { products } = draft.toObject();

  try {
    const result = await Model.updateOne(
      { userId },
      { $setOnInsert: { products } },
      { upsert: true }
    );
    return result.upsertedCount > 0;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
};

module.exports = { loadUserProducts, createListIfMissing };
