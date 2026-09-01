// Combining diacritical marks block (U+0300-U+036F), produced by NFD
// decomposition of accented characters. Built via charCode to avoid
// unicode-escape source encoding issues.
const COMBINING_MARKS_RANGE = String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f);
const COMBINING_MARKS_REGEX = new RegExp('[' + COMBINING_MARKS_RANGE + ']', 'g');

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS_REGEX, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

module.exports = { slugify };
