'use strict';

const compareValues = require('./compareValues');

module.exports = function sort(spec) {
  return function compare(a, b) {
    for (const key of Object.keys(spec)) {
      if (compareValues(a[key], b[key]) > 0) {
        return spec[key];
      } else if (compareValues(a[key], b[key]) < 0) {
        return -spec[key];
      }
    }
    return 0;
  };
}