'use strict';

const compareValues = require('./compareValues');
const mpath = require('mpath');

module.exports = function sort(spec) {
  return function compare(a, b) {
    for (const key of Object.keys(spec)) {
      const aValue = mpath.get(key, a);
      const bValue = mpath.get(key, b);
      const compare = compareValues(aValue, bValue);
      if (compare > 0) {
        return spec[key];
      } else if (compare < 0) {
        return -spec[key];
      }
    }
    return 0;
  };
};
