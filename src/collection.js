'use strict';

const Cursor = require('./cursor');
const MongooseCollection = require('mongoose/lib/collection');
const applyUpdate = require('./mongodb/applyUpdate');
const sift = require('sift').default;
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

  insertOne(doc, options, cb) {
    this._documents.push(toBSON(doc));
    cb(null);
  }

  insertMany(docs, options, cb) {
    this._documents = this._documents.concat(docs.map(toBSON));

    return cb(null);
  }

  find(query, options, cb) {
    const fn = getDocumentProjectionMapFunction(options.projection);
    const result = this._documents.filter(sift(query)).map(fn);

    if (options && options.sort) {
      result.sort((doc1, doc2) => {
        for (const key of Object.keys(options.sort)) {
          const res = compareValues(doc1[key], doc2[key], options.sort[key] < 0);
          if (res === 0) {
            continue;
          }
          return res;
        }
      });
    }

    const cursor = new Cursor(result);

    if (cb != null) {
      cb(null, cursor);
    }
    return cursor;
  }

  findOne(query, options, cb) {
    const doc = this._documents.find(sift(query));
    const fn = getDocumentProjectionMapFunction(options.projection);

    const projectedDoc = fn(doc);

    if (cb != null) {
      cb(null, projectedDoc);
    }
  }

  deleteMany(query, options, cb) {
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
    return cb(null, result);
  }

  findOneAndUpdate(query, update, options, cb) {
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

    if (cb != null) {
      return cb(null, result);
    }
  }

  updateOne(query, update, options, cb) {
    const doc = this._documents.find(sift(query));

    const result = { matchedCount: 0, modifiedCount: 0 };

    if (doc != null) {
      applyUpdate(doc, update);
      result.matchedCount = 1;
      result.modifiedCount = 1;
    }

    if (cb != null) {
      return cb(null, result);
    }
  }

  createIndex(index, options, cb) {
    if (cb != null) {
      return cb(null, index);
    }

    return;
  }
};

function getBSONType(val) {
  if (typeof val === 'number') {
    return 1;
  }
  if (typeof val === 'string') {
    return 2;
  }
  if (typeof val === 'object' &&
      val != null &&
      val._bsontype == null &&
      !Buffer.isBuffer(val) &&
      !Array.isArray(val) &&
      !(val instanceof Date) &&
      !(val instanceof RegExp)) {
    return 3;
  }
  if (Array.isArray(val)) {
    return 4;
  }
  if (Buffer.isBuffer(val)) {
    return 5;
  }
  if (val === undefined) {
    return 6;
  }
  if (val._bsontype === 'ObjectId') {
    return 7;
  }
  if (val === false) {
    return 8;
  }
  if (val === true) {
    return 9;
  }
  if (val instanceof Date) {
    return 10;
  }
  if (val === null) {
    return 11;
  }
  if (val instanceof RegExp) {
    return 12;
  }
}

function compareValues(a, b, descending) {
  if (a === b) {
    return 0;
  }

  const bsonTypeOfA = getBSONType(a);
  const bsonTypeOfB = getBSONType(b);

  if (bsonTypeOfA !== bsonTypeOfB) {
    return descending ? bsonTypeOfB - bsonTypeOfA : bsonTypeOfA - bsonTypeOfB;
  }

  if (a < b) {
    return descending ? 1 : -1;
  } else {
    return descending ? -1 : 1;
  }
}

function getDocumentProjectionMapFunction(projection) {
  const id = projection && projection._id !== 0;
  const keys = Object.getOwnPropertyNames(projection).filter(v => v !== '_id');

  if (!keys.length && id) {
    return (d) => d;
  } else if (!keys.length && !id) {
    return (d) => {
      const ret = {};
      for (const key of keys) {
        ret[key] = d[key];
      }
      return ret;
    };
  }

  const type = incVsExc(projection);

  if (type === 'inclusive') {
    return (d) => {
      const ret = {
        _id: id ? d._id : undefined
      };
      for (const key of keys) {
        ret[key] = d[key];
      }

      return ret;
    };
  } else if (type === 'exclusive') {
    return (d) => {
      const ret = {
        _id: id ? d._id : undefined
      };
      for (const key in Object.getOwnPropertyNames(d)) {
        if (!keys.includes(key)) {
          ret[key] = d[key];
        }
      }

      return ret;
    };
  } else {
    return (d) => {
      return d;
    };
  }
}

function incVsExc(projection) {
  const keys = [];
  const values = [];

  Object.entries(projection).forEach(([key, value]) => {
    if (key !== '_id') {
      keys.push[key];
      values.push(value);
    }
  });

  const ones = values.filter(v => v === 1);
  const zeros = values.filter(v => v === 0);

  if (ones.length && zeros.length) {
    throw new Error('inclusive or exclusive projections only');
  }

  return ones.length > zeros.length ? 'inclusive' : 'exclusive';
}
