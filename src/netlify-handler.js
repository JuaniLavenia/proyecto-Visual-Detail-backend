const serverless = require('serverless-http');

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
  const handleRequest = serverless(app);

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
