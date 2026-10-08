/**
 * CORS origin allowlist
 * Builds the allowed origins from FRONTEND_URL plus the optional
 * comma-separated CORS_ORIGINS, and the `origin` check used by `cors()`.
 */

// Browsers send the Origin without a trailing slash or path
const normalizeOrigin = (value) => {
  try {
    return new URL(value).origin;
  } catch (e) {
    return value.replace(/\/+$/, '');
  }
};

const buildAllowedOrigins = (frontendUrl, corsOrigins) => {
  const entries = [frontendUrl, ...String(corsOrigins || '').split(',')]
    .map((entry) => (entry || '').trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  return [...new Set(entries)];
};

/**
 * `origin` option for `cors()`.
 * - No Origin header (curl, server-to-server, health checks): allowed.
 * - Empty allowlist: every origin is allowed with a warning, so an
 *   unconfigured deploy keeps working instead of breaking the frontend.
 * - Unlisted origins get no CORS headers (the browser blocks them); no error
 *   is raised, so the request never turns into a 500.
 */
const createCorsOriginCheck = (allowedOrigins, logger = console) => {
  if (allowedOrigins.length === 0) {
    logger.warn('CORS: no allowed origins configured (FRONTEND_URL/CORS_ORIGINS); allowing every origin');
    return (origin, callback) => callback(null, true);
  }

  return (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    callback(null, allowedOrigins.includes(origin));
  };
};

module.exports = {
  buildAllowedOrigins,
  createCorsOriginCheck
};
