'use strict';

const Connection = require('./src/connection');
const Collection = require('./src/collection');

const { Binary, ObjectId, Decimal128, ReadPreference } = require('bson');

module.exports = {
  Binary,
  ObjectId,
  Decimal128,
  ReadPreference,
  Collection,
  getConnection: () => Connection
};