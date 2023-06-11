'use strict';

const Cursor = require('./cursor');
const MongooseCollection = require('mongoose/lib/collection');
const applyProjectionToDoc = require('./mongodb/applyProjectionToDoc');
const applyUpdate = require('./mongodb/applyUpdate');
const compareValues = require('./mongodb/compareValues');
const sift = require('sift').default;
const sort = require('./mongodb/sort');
const toBSON = require('./mongodb/toBSON');

module.exports = class Collection extends MongooseCollection {
  constructor(name, conn, options) {
    super(name, conn, options);
    this.Promise = options.Promise || Promise;
    this.modelName = options.modelName;
    delete options.modelName;
    this._closed = false;

    this._documents = [];
  }

  get collection() {
    return this;
  }

  async insertOne(doc, options) {
    this._documents.push(toBSON(doc));
  }

  async insertMany(docs, options) {
    this._documents = this._documents.concat(docs.map(toBSON));
  }

  find(query, options, cb) {
    const result = query == null ?
      [...this._documents] :
      this._documents.filter(sift(query));

    if (options && options.sort) {
      result.sort(sort(options.sort));
    }

    const cursor = new Cursor(result);

    if (cb != null) {
      cb(null, cursor);
    }

    return cursor;
  }

  async findOne(query, options) {
    let docs = this._documents;
    if (options && options.sort) {
      docs = [...docs].sort(sort(options.sort));
    }
    const doc = docs.find(sift(query));
    const { projection } = options || {};
    const projectedDoc = applyProjectionToDoc(doc, projection);

    return projectedDoc;
  }

  async deleteMany(query, options) {
    const result = { deletedCount: 0 };
    const filter = sift(query);

    const newDocs = [];
    for (const doc of this._documents) {
      if (filter(doc)) {
        ++result.deletedCount;
      } else {
        newDocs.push(doc);
      }
    }

    this._documents = newDocs;
    return result;
  }

  async findOneAndUpdate(query, update, options) {
    let doc = this._documents.find(sift(query));
    const result = { value: null };

    if (doc != null) {
      result.value = doc;
      applyUpdate(doc, update);
    } else if (options && options.upsert) {
      doc = { ...query };
      applyUpdate(doc, update);
      this._documents.push(doc);
      result.value = doc;
    }

    return result;
  }

  async updateOne(query, update, options) {
    const doc = this._documents.find(sift(query));

    const result = { matchedCount: 0, modifiedCount: 0 };

    if (doc != null) {
      applyUpdate(doc, update);
      result.matchedCount = 1;
      result.modifiedCount = 1;
    }

    return result;
  }

  async createIndex(index, options) {
    return;
  }

  aggregate() {
    throw new Error('Aggregations not supported');
  }
};
