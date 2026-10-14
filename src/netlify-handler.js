const serverless = require('serverless-http');

// Responses that must travel base64-encoded instead of as UTF-8 text
const BINARY_CONTENT_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Excel export
];

/**
 * serverless-http pins req.ip from a Lambda field Netlify never sends, which
 * leaves it undefined and puts every client in one rate-limit bucket. Use the
 * client IP Netlify reports; without it, drop the pinned value so Express
 * derives req.ip from trust proxy and X-Forwarded-For.
 */
const restoreClientIp = (req) => {
  const netlifyClientIp = req.headers['x-nf-client-connection-ip'];
  if (netlifyClientIp) {
    req.ip = netlifyClientIp;
  } else {
    delete req.ip;
  }
};

const DB_UNAVAILABLE_BODY = JSON.stringify({
  success: false,
  error: {
    message: 'Service temporarily unavailable, please try again shortly.',
    code: 'DB_UNAVAILABLE',
  },
});

/**
 * Netlify Function entry: make sure MongoDB is connected, then let Express
 * handle the request. A database outage answers 503 in the API envelope
 * instead of crashing the function.
 */
const createHandler = (app, connect) => {
  const handleRequest = serverless(app, {
    binary: BINARY_CONTENT_TYPES,
    request: restoreClientIp,
  });

  return async (event, context) => {
    try {
      await connect();
    } catch (err) {
      console.error('MongoDB connection failed:', err.message);
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: DB_UNAVAILABLE_BODY,
      };
    }
    return handleRequest(event, context);
  };
};

module.exports = { createHandler };
