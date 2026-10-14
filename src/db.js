const mongoose = require('mongoose');
const config = require('./config');

/**
 * Wrap a connect function so it runs once per process.
 * A serverless instance serves many requests: later calls share the first
 * (possibly still pending) connection, and a failed attempt is forgotten so
 * the next call retries instead of replaying the error.
 */
const createConnector = (openConnection) => {
  let pending = null;

  return () => {
    if (!pending) {
      pending = openConnection().catch((err) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
};

const connectDB = createConnector(() =>
  mongoose.connect(config.get('mongo.uri'), config.get('mongo.options'))
);

module.exports = { connectDB, createConnector };
