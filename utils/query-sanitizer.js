/**
 * MongoDB Query Sanitizer
 * Prevents injection attacks by sanitizing user input
 */

const sanitizeValue = (value) => {
  if (typeof value !== 'string') return value;
  
  // Remove $ prefix characters that MongoDB interprets as operators
  const sanitized = value.replace(/[\$\{\}]/g, '');
  return sanitized;
};

const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      // Block potentially dangerous keys like $where, $function, etc.
      if (key.startsWith('$') && !['$regex', '$options', '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin'].includes(key)) {
        continue; // Skip dangerous operators
      }
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    return sanitizeValue(obj);
  }
  
  return obj;
};

/**
 * Sanitize query object for MongoDB find operations
 */
const sanitizeFindQuery = (query) => {
  return sanitizeObject(query);
};

/**
 * Sanitize update object for MongoDB update operations
 */
const sanitizeUpdateQuery = (update) => {
  if (!update) return update;
  
  // Only allow safe operators
  const allowedOperators = ['$set', '$unset', '$inc', '$push', '$pull', '$addToSet'];
  const sanitized = {};
  
  for (const key in update) {
    if (key.startsWith('$')) {
      if (allowedOperators.includes(key)) {
        sanitized[key] = sanitizeObject(update[key]);
      }
      // Skip disallowed operators
    } else {
      // Direct field updates - sanitize the value
      sanitized[key] = sanitizeValue(update[key]);
    }
  }
  
  return sanitized;
};

/**
 * Sanitize sort object
 */
const sanitizeSort = (sort) => {
  if (!sort || typeof sort !== 'object') return {};
  
  const sanitized = {};
  for (const key in sort) {
    // Only allow 1 and -1 as sort values
    const val = sort[key];
    if (val === 1 || val === -1 || val === '1' || val === '-1') {
      sanitized[key] = parseInt(val);
    }
  }
  return sanitized;
};

/**
 * Sanitize projection object
 */
const sanitizeProjection = (projection) => {
  if (!projection || typeof projection !== 'object') return {};
  
  const sanitized = {};
  for (const key in projection) {
    // Only allow 0, 1, true, false
    const val = projection[key];
    if (val === 0 || val === 1 || val === true || val === false) {
      sanitized[key] = val === true ? 1 : val === false ? 0 : val;
    }
  }
  return sanitized;
};

module.exports = {
  sanitizeValue,
  sanitizeObject,
  sanitizeFindQuery,
  sanitizeUpdateQuery,
  sanitizeSort,
  sanitizeProjection
};