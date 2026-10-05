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

module.exports = {
  findTaxonomyName,
  resolveTaxonomyName,
};
