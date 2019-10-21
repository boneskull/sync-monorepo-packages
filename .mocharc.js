'use strict';

module.exports = {
  require: ['test/setup'],
  'forbid-only': Boolean(process.env.CI)
};
