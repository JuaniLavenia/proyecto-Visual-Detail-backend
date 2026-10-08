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

// Placeholder secret: fine for local development, refused in production
const DEFAULT_JWT_SECRET = 'change-me-in-production';

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
      default: DEFAULT_JWT_SECRET,
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
  app: {
    frontendUrl: {
      doc: 'Public frontend base URL (used in e-mail links)',
      format: 'url',
      default: 'http://localhost:5173',
      env: 'FRONTEND_URL'
    },
    corsOrigins: {
      doc: 'Extra allowed CORS origins, comma-separated (FRONTEND_URL is always allowed)',
      format: 'String',
      default: '',
      env: 'CORS_ORIGINS'
    },
    trustProxy: {
      doc: 'Number of reverse-proxy hops to trust for req.ip (0 locally, 1 behind Render)',
      format: 'nat',
      default: 0,
      env: 'TRUST_PROXY'
    }
  },
  smtp: {
    host: {
      doc: 'SMTP host',
      format: 'String',
      default: 'smtp-relay.brevo.com',
      env: 'SMTP_HOST'
    },
    port: {
      doc: 'SMTP port',
      format: 'port',
      default: 587,
      env: 'SMTP_PORT'
    },
    secure: {
      doc: 'Use implicit TLS (true for port 465, false for STARTTLS on 587)',
      format: Boolean,
      default: false,
      env: 'SMTP_SECURE'
    },
    from: {
      doc: 'Default sender address',
      format: 'String',
      default: 'Visual-Detailing <no-reply@visual-detailing.app>',
      env: 'SMTP_FROM'
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

/**
 * Refuse to run in production with a missing or placeholder JWT secret:
 * anyone could forge tokens signed with the public default.
 */
const assertProductionSecret = (env, secret) => {
  if (env === 'production' && (!secret || secret === DEFAULT_JWT_SECRET)) {
    throw new Error('JWT_SECRET must be set to a non-default value when NODE_ENV=production');
  }
};

// Validate on load
config.validate({ allowed: 'strict' });
assertProductionSecret(config.get('env'), config.get('jwt.secret'));

module.exports = config;
module.exports.assertProductionSecret = assertProductionSecret;
module.exports.DEFAULT_JWT_SECRET = DEFAULT_JWT_SECRET;