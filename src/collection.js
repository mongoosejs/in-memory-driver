'use strict';

const Cursor = require('./cursor');
const MongooseCollection = require('mongoose/lib/collection');
const { ObjectId } = require('bson');
const applyProjectionToDoc = require('./mongodb/applyProjectionToDoc');
const applyUpdate = require('./mongodb/applyUpdate');
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
    let result = query == null ?
      [...this._documents] :
      this._documents.filter(sift(query));

    if (options && options.sort) {
      result.sort(sort(options.sort));
    }
    if (options && options.skip) {
      result = result.slice(options.skip);
    }
    if (options && options.limit) {
      result = result.slice(0, options.limit);
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

  async deleteOne(query, options, callback) {
    const result = { deletedCount: 0 };
    const filter = sift(query);

    let docs = this._documents;
    if (options && options.sort) {
      docs = [...docs].sort(sort(options.sort));
    }

    let docToDelete = null;
    for (let i = 0; i < docs.length; ++i) {
      if (filter(docs[i])) {
        docToDelete = docs[i];
        break;
      }
    }
    if (docToDelete != null) {
      this._documents.splice(this._documents.indexOf(docToDelete), 1);
      result.deletedCount = 1;
    }

    if (callback) {
      callback(null, result);
    }

    return result;
  }

  async findOneAndUpdate(query, update, options) {
    let doc = this._documents.find(sift(query));
    const result = { value: null };

    if (doc != null) {
      result.value = doc;
      applyUpdate(doc, update);
    } else if (options && options.upsert) {
      doc = { _id: new ObjectId(), ...query };
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
