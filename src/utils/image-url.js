/**
 * Brand/category image URLs: empty (no image) or an absolute http(s) URL.
 * The route validators run the full express-validator isURL check; this is
 * the model-level guard so no other write path can store e.g. javascript: URLs.
 */
const IMAGE_URL_MAX_LENGTH = 2048;

const isHttpUrlOrEmpty = (value) => {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || value.length > IMAGE_URL_MAX_LENGTH) return false;

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
};

module.exports = { isHttpUrlOrEmpty, IMAGE_URL_MAX_LENGTH };
