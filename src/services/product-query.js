/**
 * Product list query helpers
 * Pure building blocks for GET /productos filters, kept apart from the
 * service so they can be unit tested without a database.
 */

const { slugify } = require('../utils/slugify');

const normalizeName = (value) => value.normalize('NFC').trim().toLowerCase();

/**
 * Resolve a brand/category filter value (slug or name) to the canonical
 * name stored on Product. Slug match wins; a case-insensitive exact name
 * match covers legacy links that still carry the name. Returns null when
 * nothing matches (never a partial match).
 */
const findTaxonomyName = (value, catalog = []) => {
  if (typeof value !== 'string' || !value.trim()) return null;

  const slug = slugify(value);
  const bySlug = slug && catalog.find((entry) => entry?.slug === slug);
  if (bySlug) return bySlug.name;

  // Compared in memory instead of an anchored $regex: query-sanitizer.js
  // strips "$" from query strings, which breaks anchored patterns.
  const lookup = normalizeName(value);
  const byName = catalog.find(
    (entry) => typeof entry?.name === 'string' && normalizeName(entry.name) === lookup,
  );
  return byName ? byName.name : null;
};

/**
 * Load the Brand/Category catalog and resolve `value` against it.
 * The catalogs are small (tens of entries), so one lean find is cheaper
 * and safer than building a case-insensitive query from user input.
 */
const resolveTaxonomyName = async (Model, value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const catalog = await Model.find({}).select('name slug').lean();
  return findTaxonomyName(value, catalog);
};

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

/**
 * Escape user input so it is matched literally inside a $regex
 * (prevents regex injection / catastrophic backtracking).
 */
const escapeRegex = (value) => String(value ?? '').replace(REGEX_SPECIAL_CHARS, '\\$&');

// Fixed sort map: the client picks a key, never a raw sort object.
// _id breaks price ties so pagination is stable across pages.
const SORT_MAP = {
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
};
const DEFAULT_SORT = { _id: -1 };

const buildSort = (sort) => {
  const selected = Object.prototype.hasOwnProperty.call(SORT_MAP, sort) ? SORT_MAP[sort] : DEFAULT_SORT;
  return { ...selected };
};

const isFilterValue = (value) => typeof value === 'string' && value.trim().length > 0;

/**
 * Build the Product find filter. `brand` / `category` must already be the
 * resolved canonical names (equality match); `search` is raw user input
 * and is escaped before going into $regex.
 *
 * The result must NOT go through sanitizeFindQuery: it strips "$" from
 * string values, which would corrupt an escaped "\$" into a dangling "\".
 * Keys are fixed here and every value is a checked string, so there is no
 * operator injection surface.
 */
const buildProductFilter = ({ brand, category, search } = {}) => {
  const filter = {};
  if (isFilterValue(brand)) filter.brand = brand;
  if (isFilterValue(category)) filter.category = category;
  if (isFilterValue(search)) {
    filter.name = { $regex: escapeRegex(search.trim()), $options: 'i' };
  }
  return filter;
};

module.exports = {
  findTaxonomyName,
  resolveTaxonomyName,
  escapeRegex,
  buildSort,
  buildProductFilter,
};
