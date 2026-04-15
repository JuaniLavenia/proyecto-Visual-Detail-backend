require("dotenv").config();

const mongoose = require("mongoose");
const app = require('./app');
const config = require('./config');

// Database connection with retry logic
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

const PORT = config.get('port');

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));