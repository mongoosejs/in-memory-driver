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

  createCollection(name, options, callback) {
    this.collection(name, options);
    callback(null);
  }

  async dropCollection(name, callback) {
    delete this.collections[name];
    callback(null);
  }

  openUri(uri, options, callback) {
    if (!allowedUris.find(allowedUri => uri.startsWith(allowedUri))) {
      return callback(new Error('Connection failed'));
    }
    this.readyState = 1;
    callback && callback(null, this);
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
};
