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
    // https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/#considerations
    if (command.$group) {
      const group = [];
      const obj = {};
      // need to process _id better
      if (command.$group._id == null) {
        obj._id = null;
      } else {
        obj._id = command.$group._id;
      }
      const identifiers = getGroupKeys(docs, command.$group._id);

      for (const key in command.$group) {
        if (key == '_id') {
          continue;
        } else if (command.$group[key] == '$accumulator') {

        } else if (command.$group[key] == '$addToSet') {

        } else if (command.$group[key] == '$avg') {
          
        } else if (command.$group[key] == '$bottom') {
          
        } else if (command.$group[key] == '$bottomN') {
          
        } else if (command.$group[key] == '$count') {
          if (command.$group._id == null) {
            obj[key] = docs.length;
          } else {
          }
        } else if (command.$group[key] == '$first') {
          
        } else if (command.$group[key] == '$firstN') {
          
        } else if (command.$group[key] == '$last') {
          const index = docs.lastIndexOf(command.$group[key].$last);
          obj[key] = docs[index];
        } else if (command.$group[key] == '$lastN') {
          let temp = [...docs];
          const arr = [];
          for (let i = 0; i < command.$group[key].$lastN.n; i++) {
            const index = temp.lastIndexOf(command.$group[key].$lastN.input);
            arr.push(temp[index]);
            temp.splice(index, 1);
          }
          obj[key] = arr;
        } else if (command.$group[key] == '$max') {
          let max = 0;
          // need to filter whatever the id is and then check against each one.
          // case where we just want the biggest value on the property of all the docs with that property
          for (let index = 0; index < identifiers.length; index++) {
            const filteredDocs = docs.filter(x => x[identifiers[index]] == identifiers[index]);
            for (let i = 0; i < filteredDocs.length; i++) {
              if (filteredDocs[i][command.$group[key].$max] > max) {
                max = filteredDocs[i][command.$group[key].$max]
              }
            }
            obj._id = identifiers[index]; // this is not correct?
            obj[key] = max;
            // do we push now?
          }
        } else if (command.$group[key] == '$maxN') {
          
        } else if (command.$group[key] == '$mergeObjects') {
          
        } else if (command.$group[key] == '$min') {
          
        } else if (command.$group[key] == '$push') {
          for (let i = 0; i < Object.keys(command.$group[key].$push).length; i++) {
            const newObj = {};
          }
          obj[key] = '';
        } else if (command.$group[key] == '$stdDevPop') {
          
        } else if (command.$group[key] == '$stdDevSamp') {
          
        } else if (command.$group[key] == '$sum') {
          
        } else if (command.$group[key] == '$top') {
          
        } else if (command.$group[key] == '$topN') {
          
        } else {
          console.log(`${command.$group[key]} not a valid option. Moving on.`);
        }
      }
      // or push here?
      docs = [...group];
    }
    if (command.$project) {
      const projDocs = [];
      for (let i = 0; i < docs.length; i++) {
        const doc = applyProjectionToDoc(docs[i], command.$project);
        projDocs.push(doc);
      }
      docs = [...projDocs];
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
      // TODO
    }
  }
  return docs;
}

/* 
  Helper function for aggregation to get all possible values for the given property.
  Doing so allows us to get the total times we'll need to iterate through
  the documents to return documents with the correct identifiers.
*/

function getGroupKeys(array, groupId) {
  if (groupId == null) return;
  const keys = [];
  let property = '';
  let properties = '';
  if (Object.keys(groupId).length == 0) { // EX:  "$item" and $item has values abc, jkl, xyz
    property = groupId.substring(1);
  } else { // EX: { day: { $dayOfYear: "$date"}, year: { $year: "$date" } } <= can these be different? Assume they can.
    properties = traverseObject(groupId);
  }

  for (let i = 0; i < array.length; i++) {
    if (properties) {
      for (let index = 0; index < properties.length; index++) {
        property = properties[index].substring(1); // handle $
      }
    }
    if (array[i][property] && !keys.includes(array[i][property])) {
      keys.push(property);
    }
  }
  return keys; // should be [abc, jkl, xyz]
}

// should return $date for EX:  { day: { $dayOfYear: "$date"}, year: { $year: "$date" } }
// add functionality to remove duplicates
// return as array
function traverseObject(obj) {
  const keys = [];
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      traverseObject(obj[key])
    } else {
      keys.push(obj[key]);
    }
  });
  // now remove duplicates
  const removeDupes = new Set(keys);
  return [...removeDupes];
}
