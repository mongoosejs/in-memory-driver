'use strict';

const Cursor = require('./cursor');
const MongooseCollection = require('mongoose/lib/collection');
const applyUpdate = require('./mongodb/applyUpdate');
const sift = require('sift').default;
const toBSON = require('./mongodb/toBSON');

const mongoose = require('mongoose');

mongoose.Query.prototype.cursor = function cursor() {
  const ret = this._collection.collection._find(this._conditions, this.options);
  return ret;
};

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

  _find(query, options) {
    const result = query == null ?
      [...this._documents] :
      this._documents.filter(sift(query));

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

    return cursor;
  }

  async find(query, options) {
    return this._find(query, options);
  }

  async findOne(query, options) {
    const doc = this._documents.find(sift(query));
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

function applyProjectionToDoc(doc, projection) {
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
}

function projectionInfo(projection) {
  const suppress = projection && projection._id === 0;
  const _id = key => key !== '_id';
  const nonIdKeys = Object.getOwnPropertyNames(projection).filter(_id);

  const allOnesOrZeros = nonIdKeys.map(key => {
    return projection[key];
  });

  return {
    keys: nonIdKeys,
    inclusive: allOnesOrZeros.includes(1),
    exclusive: allOnesOrZeros.includes(0),
    _id: {
      suppress
    }
  };
}

function aggregate(pipeline) {
  if (!Array.isArray(pipeline)) {
    throw new Error('Please provide an array of objects as an argument');
  }
  let docs = [...this._documents];
  for (const command of pipeline) {
    if (command.$match) {
      docs = [...docs._find(command.$match)];
    }
    if (command.$group) {

    }
    if (command.$project) {

    }
    if (command.$limit) {
      docs = [...docs.slice(0, command.$limit)];
    }
    if (command.$skip) {
      docs = [...docs.slice(command.$skip)];
    }
    if (command.$sort) {
      docs.sort(function(a, b) {
        for (const key in command.$sort) {
          if (command.$sort.hasOwnProperty(key)) {
            if (a[key] > b[key]) {
              return command.$sort[key];
            }
            if (a[key] < b[key]) {
              return -command.$sort[key];
            }
          }
        }
        return 0;
      });
    }
    if (command.$unwind) {
      const unwind = [];
      const path = command.$unwind.hasOwnProperty('path') ? command.$unwind.path : typeof command.$unwind == 'string' ? command.$unwind : '';
      const preserveNullAndEmptyArrays = command.$unwind.preserveNullAndEmptyArrays ?? false;
      const includeArrayIndex = (command.$unwind.includeArrayIndex && !command.$unwind.includeArrayIndex.startsWith('$')) ? command.$unwind.includeArrayIndex : '';
      for (let i = 0; i < docs.length; i++) {
        const entry = docs[i];
        if (path == '') {
          throw new Error('Please provide valid syntax for the unwind command');
        }
        // https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/#behaviors
        const EmptyMissingOrNull = entry[path] == null || typeof entry[path] === 'undefined' || entry[path].length == 0;
        if ((EmptyMissingOrNull && preserveNullAndEmptyArrays) || (!EmptyMissingOrNull && !Array.isArray(entry[path]))) {
          if (includeArrayIndex) {
            entry[includeArrayIndex] = null;
          }
          unwind.push(entry);
          continue;
        } else if (Array.isArray(entry[path])) {
          for (let index = 0; index < entry[path].length; index++) {
            const obj = {};
            for (const key in entry) {
              if (key == path) {
                obj[key] = entry[path][index];
                if (includeArrayIndex) {
                  obj[includeArrayIndex] = index;
                }
              } else {
                obj[key] = entry[key];
              }
            }
            unwind.push(obj);
          }
        }
      }
      docs = [...unwind];
    }
    if (command.$lookup) {

    }
  }
  return docs;
}


