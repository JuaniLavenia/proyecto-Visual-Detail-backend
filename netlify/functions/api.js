// Netlify Function serving the whole Express app (see netlify.toml).
// Locally the app still runs as a long-lived server through src/server.js.
const app = require('../../src/app');
const { connectDB } = require('../../src/db');
const { createHandler } = require('../../src/netlify-handler');

exports.handler = createHandler(app, connectDB);
