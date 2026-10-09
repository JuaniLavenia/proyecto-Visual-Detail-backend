/**
 * Display-name normalization for products, brands and categories.
 *
 * Trims, collapses inner runs of whitespace to one space and uppercases the
 * first character when it is a lowercase letter. The rest of the name is
 * kept as typed ("KIT PARA..." stays). Non-strings are returned unchanged so
 * validation keeps reporting them as before.
 */
const normalizeName = (value) => {
  if (typeof value !== 'string') return value;

  const collapsed = value.trim().replace(/\s+/g, ' ');
  if (!collapsed) return collapsed;

  // Code-point aware so a leading astral character is never split in half
  const [first] = collapsed;
  const upper = first.toLocaleUpperCase('es');
  // Only a lowercase letter changes: digits and symbols uppercase to themselves
  if (first === upper) return collapsed;

  return upper + collapsed.slice(first.length);
};

module.exports = { normalizeName };
