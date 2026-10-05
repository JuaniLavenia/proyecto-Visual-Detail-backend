require("dotenv").config();

const express = require("express");
const app = express();

// Security: Load config first to validate environment variables
const config = require('./config');

// Behind a reverse proxy, req.ip must come from X-Forwarded-For so per-IP
// rate limits do not collapse into one shared bucket.
app.set("trust proxy", config.get("app.trustProxy"));

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

// Security: Rate limiting - solo en endpoints críticos (auth), aplicado
// por ruta en routes/auth.router.js. El límite global rompe navegación
// normal de usuarios legítimos.

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
app.use("/api", require("./routes/taxonomy.routes"));
app.use("/api", require("./routes/productos"));
app.use("/api", require("./routes/pedidos"));
app.use("/api", require("./routes/favorites.routes"));
app.use("/api", require("./routes/cart.routes"));
app.use("/api", require("./routes/auth.router"));

// Error handling middleware (must be after all routes)
const { errorMiddleware } = require("./middleware/error.middleware");
app.use(errorMiddleware);

module.exports = app;