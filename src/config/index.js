const convict = require('convict');

// Add custom format for URL validation
convict.addFormat({
  name: 'url',
  validate: function (val) {
    try {
      new URL(val);
    } catch (e) {
      throw new Error('Invalid URL format');
    }
  },
  coerce: function (val) {
    return val;
  }
});

const config = convict({
  env: {
    doc: 'The application environment.',
    format: ['development', 'production', 'test'],
    default: 'development',
    env: 'NODE_ENV'
  },
  port: {
    doc: 'The port to bind to.',
    format: 'port',
    default: 5000,
    env: 'PORT'
  },
  mongo: {
    uri: {
      doc: 'MongoDB connection URI',
      format: 'url',
      default: 'mongodb://localhost:27017/visual-detail',
      env: 'MONGODB_URI'
    },
    options: {
      maxPoolSize: {
        doc: 'Max connection pool size',
        format: 'int',
        default: 10,
        env: 'MONGO_MAX_POOL_SIZE'
      },
      serverSelectionTimeoutMS: {
        doc: 'Server selection timeout',
        format: 'int',
        default: 5000,
        env: 'MONGO_SERVER_SELECTION_TIMEOUT'
      },
      socketTimeoutMS: {
        doc: 'Socket timeout',
        format: 'int',
        default: 45000,
        env: 'MONGO_SOCKET_TIMEOUT'
      }
    }
  },
  jwt: {
    secret: {
      doc: 'JWT secret key',
      format: 'String',
      default: 'change-me-in-production',
      env: 'JWT_SECRET'
    },
    accessExpiry: {
      doc: 'Access token expiry',
      format: 'String',
      default: '15m',
      env: 'JWT_ACCESS_EXPIRY'
    },
    refreshExpiry: {
      doc: 'Refresh token expiry',
      format: 'String',
      default: '7d',
      env: 'JWT_REFRESH_EXPIRY'
    }
  },
  rateLimit: {
    windowMs: {
      doc: 'Rate limit window in milliseconds',
      format: 'int',
      default: 15 * 60 * 1000, // 15 minutes
      env: 'RATE_LIMIT_WINDOW_MS'
    },
    max: {
      doc: 'Max requests per window',
      format: 'int',
      default: 100,
      env: 'RATE_LIMIT_MAX'
    }
  },
  smtp: {
    host: {
      doc: 'SMTP host',
      format: 'String',
      default: 'sandbox.smtp.mailtrap.io',
      env: 'SMTP_HOST'
    },
    port: {
      doc: 'SMTP port',
      format: 'port',
      default: 2525,
      env: 'SMTP_PORT'
    },
    user: {
      doc: 'SMTP user',
      format: 'String',
      default: '',
      env: 'SMTP_USER'
    },
    pass: {
      doc: 'SMTP password',
      format: 'String',
      default: '',
      env: 'SMTP_PASS'
    }
  }
});

// Validate on load
config.validate({ allowed: 'strict' });

module.exports = config;