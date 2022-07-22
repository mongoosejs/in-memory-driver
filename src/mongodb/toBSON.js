'use strict';

module.exports = function toBSON(obj) {
  if (typeof obj.toBSON === 'function') {
    return obj.toBSON();
  }

  return obj;
};
