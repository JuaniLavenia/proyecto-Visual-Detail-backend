require("dotenv").config();

const express = require("express");
const app = express();

// Security: Load config first to validate environment variables
const config = require('./config');

// Security: Helmet for HTTP headers (configurado para permitir imágenes cross-origin)
const helmet = require("helmet");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:", "http:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Security: Rate limiting
const { defaultLimiter, staticLimiter } = require("./middleware/rate-limiter");

// Apply static limiter BEFORE default to /public/img (images)
app.use("/public", staticLimiter);

// Apply default limiter to all other routes
app.use(defaultLimiter);

// CORS
const cors = require("cors");
app.use(cors());

// Body parsers
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString()
    }
  });
});

app.get("/", (req, res) => {
  res.send("Hola");
});

// Routes
app.use("/api", require("./routes/users"));
app.use("/api", require("./routes/productos"));
app.use("/api", require("./routes/pedidos"));
app.use("/api", require("./routes/favorites.routes"));
app.use("/api", require("./routes/cart.routes"));
app.use("/api", require("./routes/auth.router"));

// Error handling middleware (must be after all routes)
const { errorMiddleware } = require("./middleware/error.middleware");
app.use(errorMiddleware);

module.exports = app;