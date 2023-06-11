'use strict';

const projectionInfo = require('./projectionInfo');

module.exports = function applyProjectionToDoc(doc, projection) {
  if (!projection || !Object.keys(projection).length) {
    return doc;
  }

  const { keys, inclusive, exclusive, _id } = projectionInfo(projection);
  const ret = {};

  if (inclusive) {
    for (const key of keys) {
      ret[key] = doc[key];
    }
  } else if (exclusive) {
    for (const docKey of Object.getOwnPropertyNames(doc)) {
      if (keys.includes(docKey)) {
        continue;
      }
      ret[docKey] = doc[docKey];
    }
  }

  if (!_id.suppress) {
    ret._id = doc._id;
  }

  return ret;
};
