'use strict';

const Collection = require('./collection');
const MongooseConnection = require('mongoose/lib/connection');

const allowedUris = [
  'mongodb://localhost:27017'
];

module.exports = class Connection extends MongooseConnection {
  collection(name, options) {
    if (!(name in this.collections)) {
      this.collections[name] = new Collection(name, this, options);
    }
    return super.collection(name, options);
  }

  createCollection(name, options) {
    this.collection(name, options);
  }

  async dropCollection(name) {
    delete this.collections[name];
  }

  openUri(uri, options) {
    if (!allowedUris.find(allowedUri => uri.startsWith(allowedUri))) {
      throw new Error('Connection failed');
    }
    this.readyState = 1;
    return Promise.resolve(this);
  }

  asPromise() {
    return Promise.resolve(this);
  }

  doClose(force, cb) {
    if (cb) {
      cb(null);
    }
    return this;
  }

  async dropDatabase() {
    this.collections = {};
  }
};
