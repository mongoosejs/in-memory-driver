'use strict';

module.exports = class Cursor {
  constructor(docs) {
    this.docs = docs;
    this.index = 0;
  }

  async next() {
    if (this.index >= this.docs.length) {
      return null;
    }

    return this.docs[this.index++];
  }

  async toArray() {
    return this.docs;
  }
};
