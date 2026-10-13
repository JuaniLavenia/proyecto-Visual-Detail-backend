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

module.exports = { loadUserProducts };
