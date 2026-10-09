/**
 * Pure planning for scripts/normalize-names.js: which stored names change
 * under normalizeName and which ones cannot be written.
 *
 * Brand and category names are unique. Every doc is grouped by its target
 * (normalized) name; a group with more than one doc is a collision and none
 * of its docs is changed. Because normalizeName is idempotent, this also
 * covers a target equal to another doc's current name, and applying the
 * remaining changes in any order never violates the unique index.
 *
 * Product brand/category fields reference taxonomy names by exact value, so
 * they follow the taxonomy renames instead of being normalized on their own.
 */
const { normalizeName } = require('./normalize-name');

const idOf = (doc) => String(doc._id);

const planUniqueNameChanges = (docs) => {
  const groups = new Map();
  for (const doc of docs) {
    if (typeof doc.name !== 'string') continue;
    const target = normalizeName(doc.name);
    if (!groups.has(target)) groups.set(target, []);
    groups.get(target).push(doc);
  }

  const changes = [];
  const collisions = [];
  for (const [target, group] of groups) {
    const changing = group.filter((doc) => doc.name !== target);
    if (changing.length === 0) continue;

    if (group.length > 1) {
      collisions.push({
        name: target,
        docs: group.map((doc) => ({ id: idOf(doc), name: doc.name })),
      });
      continue;
    }

    changes.push({ id: idOf(changing[0]), from: changing[0].name, to: target });
  }

  return { changes, collisions };
};

// A product value follows the rename of the taxonomy entry it names. A value
// that names no entry but normalizes to an existing one (for example after a
// partial earlier run) is pointed at that entry; anything else is kept.
const buildReferenceResolver = (taxonomyDocs, changes) => {
  const renames = new Map(changes.map((change) => [change.from, change.to]));
  const currentNames = new Set(taxonomyDocs.map((doc) => doc.name).filter((name) => typeof name === 'string'));

  return (value) => {
    if (typeof value !== 'string') return value;
    if (renames.has(value)) return renames.get(value);
    if (currentNames.has(value)) return value;
    const target = normalizeName(value);
    return currentNames.has(target) ? target : value;
  };
};

const planProductChanges = (products, { brands = [], categories = [], brandChanges = [], categoryChanges = [] } = {}) => {
  const resolveBrand = buildReferenceResolver(brands, brandChanges);
  const resolveCategory = buildReferenceResolver(categories, categoryChanges);

  const changes = [];
  for (const product of products) {
    const set = {};
    const from = {};

    const targets = {
      name: normalizeName(product.name),
      brand: resolveBrand(product.brand),
      category: resolveCategory(product.category),
    };
    for (const [field, target] of Object.entries(targets)) {
      if (target !== product[field]) {
        set[field] = target;
        from[field] = product[field];
      }
    }

    if (Object.keys(set).length > 0) {
      changes.push({ id: idOf(product), from, set });
    }
  }

  return { changes };
};

const planNameChanges = ({ products = [], brands = [], categories = [] } = {}) => {
  const brandPlan = planUniqueNameChanges(brands);
  const categoryPlan = planUniqueNameChanges(categories);
  const productPlan = planProductChanges(products, {
    brands,
    categories,
    brandChanges: brandPlan.changes,
    categoryChanges: categoryPlan.changes,
  });

  return { brands: brandPlan, categories: categoryPlan, products: productPlan };
};

module.exports = { planNameChanges, planUniqueNameChanges, planProductChanges };
