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
const { defaultLimiter, staticLimiter } = require("./middlewares/rate-limiter");

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

// Database connection with retry logic
const mongoose = require("mongoose");

const connectWithRetry = async () => {
  const mongoUri = config.get('mongo.uri');
  const mongoOptions = config.get('mongo.options');
  
  const maxRetries = 5;
  const retryInterval = 5000; // 5 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(mongoUri, mongoOptions);
      console.log("mongoose conectado");
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryInterval/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      } else {
        console.error("Max retries reached. Exiting.");
        process.exit(1);
      }
    }
  }
};

// Connect to database
connectWithRetry();

// Routes
app.use("/api", require("./routes/users"));
app.use("/api", require("./routes/productos"));
app.use("/api", require("./routes/pedidos"));
app.use("/api", require("./routes/favorites.routes"));
app.use("/api", require("./routes/cart.routes"));
app.use("/api", require("./routes/auth.router"));

// Error handling middleware (must be after all routes)
const { errorMiddleware } = require("./middlewares/error.middleware");
app.use(errorMiddleware);

const PORT = config.get('port');

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));