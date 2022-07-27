'use strict';

module.exports = class Cursor {
  constructor(docs) {
    this.docs = docs;
    this.index = 0;
  }

  next(cb) {
    if (index >= this.docs.length) {
      return cb(null, null);
    }

    cb(null, this.docs[index++]);
  }

  toArray(cb) {
    return cb(null, this.docs);
  }
};
