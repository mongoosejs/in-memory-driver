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

  aggregate(pipeline) {
    if (!Array.isArray(pipeline)) {
      throw new Error('Please provide an array of objects as an argument');
    }

    let docs = [...this._documents];
    for (const command of pipeline) {
      if (command.$match) { // TODO: fix
        const result = docs.filter(sift(command.$match));
        docs = [...result];
      }
      // https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/#considerations
      if (command.$group) {
        const group = [];
        const groupKey = command.$group._id == null ? null : command.$group._id;
        const identifiers = getGroupKeyValues(docs, groupKey);
  
        for (const key in command.$group) {
          if (key == '_id') {
            continue;
          } else if (checkKey(command.$group[key], '$accumulator')) {
  
          } else if (checkKey(command.$group[key], '$addToSet')) {
  
          } else if (checkKey(command.$group[key], '$avg')) {
            
          } else if (checkKey(command.$group[key], '$bottom')) {
            
          } else if (checkKey(command.$group[key], '$bottomN')) {
            
          } else if (checkKey(command.$group[key], '$count')) { // does not take any args
            if (command.$group._id == null) {
              obj[key] = docs.length;
            } else {
              let count = 0;
              for (let i = 0; i < identifiers.length; i++) {
                const countDoc = {};
                for (let j = 0; j < docs.length; j++) {
                  if (docs[j][groupKey.substring(1)] == identifiers[i]) {
                    count++;
                  }
                }
                countDoc._id = identifiers[i];
                countDoc[key] = count;
                group.push(countDoc);
              }
            }
          } else if (checkKey(command.$group[key], '$first')) {
            
          } else if (checkKey(command.$group[key], '$firstN')) {
            
          } else if (checkKey(command.$group[key], '$last')) {
            const index = docs.lastIndexOf(command.$group[key].$last);
            obj[key] = docs[index];
          } else if (checkKey(command.$group[key], '$lastN')) {
            let temp = [...docs];
            const arr = [];
            for (let i = 0; i < command.$group[key].$lastN.n; i++) {
              const index = temp.lastIndexOf(command.$group[key].$lastN.input); // input can be an array, need to account for that
              arr.push(temp[index]);
              temp.splice(index, 1);
            }
            obj[key] = arr;
          } else if (checkKey(command.$group[key], '$max')) {
            let max = 0;
            const maxDoc = {};
            // need to filter whatever the id is and then check against each one.
            // case where we just want the biggest value on the property of all the docs with that property
            if (groupKey == null) {
              maxDoc._id = null;
              if (typeof command.$group[key].$max !== 'string') { // Ex: $max: { $multiply: ["$price", "$quantity" ] }
                // https://www.mongodb.com/docs/manual/reference/operator/aggregation/
                // TODO: Fix how opts is handled. Cannot handle the example query below
                // Example query { $subtract: [ { $add: [ "$price", "$fee" ] }, "$discount" ] }
                opts = Object.keys(command.$group[key].$max);
                // https://www.mongodb.com/docs/manual/reference/operator/aggregation/max/#syntax
                // Could either be an object or an array, need to handle both
                if (Array.isArray(command.$group[key].$max)) {
                  for (let i = 0; i < command.$group[key].$max.length; i++) {
                    // go through each expression and prep for processing
                  }
                }
                // has to be at least two arguments
                // TODO: address comments
                // this.conn.models[this.modelName].schema
                if (opts.includes('$multiply')) { // args have to either be numbers or a property that resolves to a number
                  const args = command.$group[key].$max.$multiply;
                  let num = 1;
                  for (let i = 0; i < docs.length; i++) {
                    for (let j = 0; j < args.length; j++) {
                      if (typeof args[j] == 'number') {
                        num *= args[j];
                      } else if (typeof args[j] == 'string' && typeof docs[i][args[j].substring(1)] == 'number') {
                        num *= docs[i][args[j].substring(1)];
                      } 
                    }
                    if (num > max) {
                      max = num;
                    }
                    num = 1;
                  }
                } else if (opts.includes('$add')) {
                  // args have to be either all numbers or numbers and a date
                  // if one arg is a date, treats the other arg as milliseconds to add to the date
                  // need to check which arg is a date, whether it be something passed or the property on the docs.
                  const args = command.$group[key].$max.$add;
                  const dateArg = args.filter(x => x instanceof Date);
                  let num = 0;
                  if (dateArg.length > 1) {
                    throw new Error('$add only supports 1 date');
                  } else if (dateArg.length == 1) {
                    // check if valid date
                    const date = args.find(x => x instanceof Date);
                    if (!isNaN(date)) {
                      throw new Error('Not a valid date');
                    }

                  } else { // no args passed were raw dates, still need to check for dates here
                    // its two different processes if an arg is a date, need to do an initial check
                    const props = args.filter(x => typeof x == 'string');
                    let dateProp = '';
                    // should iterate through all the docs just incase the first doc is missing the property or has a missing value.
                    for (let index = 0; index < docs.length; index++) {
                      for (let i = 0; i < props.length; i++); {
                        const isDate = (docs[index][props[i].substring(1)] instanceof Date && !isNaN(docs[index][props[i].substring(1)])) || // valid date
                                       (typeof docs[index][props[i].substring(1)] == 'string' && !Number.isNaN(Date.parse(docs[index][props[i].substring(1)]))) || // date string
                                       (typeof docs[index][props[i].substring(1)] == 'number'); // assume if it is a number then it is the date in milliseconds
                        // this prop is a date, all other values will be considered milliseconds to add to it.
                        if (isDate) {
                          // designate the prop as the defacto date, remove it from the args, then treat the args whether num or prop strings as milliseconds
                          dateProp = props[i];
                          const dateIndex = args.findIndex(x => x == props[i]);
                          args.splice(dateIndex, 1);
                          break;
                        }
                      }
                    }
                    for (let i = 0; i < docs.length; i++) {
                      for (let j = 0; j < args.length; j++) {
                        if (typeof args[j] == 'number') {
                          num += args[j];
                        } else if (typeof args[j] == 'string') {
                            if (dateProp) {
                              if (docs[i][args[j].substring(1)] instanceof Date && !isNaN(docs[i][args[j].substring(1)])) { // valid date
                                num = docs[i][args[j].substring(1)].getTime() + num;
                              } else if (typeof docs[i][args[j].substring(1)] == 'string' && !Number.isNaN(Date.parse(docs[i][args[j].substring(1)]))) { // date string
                                num = Date.parse(docs[i][args[j].substring(1)]) + num;
                              }
                            } else {
                              num += docs[i][args[j].substring(1)];
                            }
                        }
                      }
                      if (dateProp) {
                        if (docs[i][dateProp.substring(1)] instanceof Date && !isNaN(docs[i][dateProp.substring(1)])) { // valid date
                          num = docs[i][dateProp.substring(1)].getTime() + num;
                        } else if (typeof docs[i][dateProp.substring(1)] == 'string' && !Number.isNaN(Date.parse(docs[i][dateProp.substring(1)]))) { // date string
                          num = Date.parse(docs[i][dateProp.substring(1)]) + num;
                        } else { // property is a number
                          num = docs[i][dateProp.substring(1)] + num;
                        }
                      }
                      if (num > max) {
                        max = num;
                      }
                      num = 0;
                    }
                  }
                } else if (opts.includes('$subtract')) {
                  // subtraction is picky, will only do two properties at a time. 2nd - 1st
                  // Example query { $subtract: [ { $add: [ "$price", "$fee" ] }, "$discount" ] } <= not currently supported on in-memory-driver
                  let num = 0;
                  const args = command.$group[key].$max.$subtract;
                  // Either two nums, two dates, or a date and a num. Date must be first arg in case of subtracting number from date
                  // date - num results in a date string
                  // if its two dates, returns the total milliseconds
                  // first, check if any of the arguments are strings/properties on a doc
                  let first = '';
                  if (typeof args[0] == 'string') {
                    // if they are, determine if what it resolves to is valid for this operation
                    if (getPathType(this.conn, this.modelName, args[0].substring(1)) == 'Number') { // first arg resolves to a number
                      first = 'Number'
                    } else if (getPathType(this.conn, this.modelName, args[0].substring(1)) == 'Date') { // first arg resolves to a date
                      first = 'Date'
                    } else {
                      // does not resolve to anything valid for this operation
                      throw new Error('arguments passed must either be a number, a date, or resolve to those values');
                    }
                  } else if (typeof args[0] == 'number') {
                    first = 'Number'
                  } else if (args[0] instanceof Date && !isNaN(args[0])) {
                    first = 'Date'
                  } else {
                    // check if its a nested operation, i.e. { $subtract: [ { $add: [ "$price", "$fee" ] }, "$discount" ] }, otherwise not valid
                  }
                  // where the math happens
                  if (typeof args[1] == 'string') { // second arg is string, check what it resolves to.
                    if (getPathType(this.conn, this.modelName, args[1].substring(1)) == 'Date') { // resolves to date
                      if (first == 'Date') { // subtracting two dates
                        for (let i = 0; i < docs.length; i++) {
                          if (typeof args[0] == 'string') {
                            num = docs[i][args[1].substring(1)] - docs[i][args[0].substring(1)];
                          } else {
                            num = docs[i][args[1].substring(1)] - args[0]; // convert to milli?
                          }
                          if (num > max) {
                            max = num;
                          }
                        }

                      } else {
                        throw new Error('Date must be the first argument when subtracting');
                      }
                    } else if (getPathType(this.conn, this.modelName, args[1].substring(1)) == 'Number') { // resolves to number
                      if (first == 'Date') { // number - date
                        // while this should return a date string, because this is in a max operation it only matters who has the more milliseconds.
                        for (let i = 0; i < docs.length; i++) {
                          if (typeof args[0] == 'string') {
                            num = docs[i][args[1].substring(1)] - docs[i][args[0].substring(1)]
                          } else {
                            num = docs[i][args[1].substring(1)] - args[0];
                          }
                          if (num > max) {
                            max = num;
                          }
                        }
                      }
                    } else {
                      throw new Error('arguments passed must either be a number, a date, or resolve to those values');
                    }
                  } else if (args[1] instanceof Date && !isNaN(args[1])) { // second arg is a raw date
                    if (first == 'Number') {
                      throw new Error('Date must be the first argument when subtracting a number from a date');
                    } else if (first == 'Date') { // date - date
                      for (let i = 0; i < docs.length; i ++) {
                        if (typeof args[0] == 'string') {
                          num = args[1] - docs[i][args[0].substring(1)];
                        } else {
                          num = args[1] - args[0];
                        }
                        if (num > max) {
                          max = num;
                        }
                      }
                    }
                  } else if (typeof args[1] == 'number') { // second arg is number
                    for (let i = 0; i < docs.length; i++) {
                      if (typeof args[0] == 'string') {
                        num = args[1] - docs[i][args[0].substring(1)] ;
                      } else {
                        num = args[1] - args[0];
                      }
                      if (num > max) {
                        max = num;
                      }
                    }
                  } else { // nested operation

                  }
                } else if (opts.includes('$divide')) {
                  // division is picky, will only do two properties at a time. 1st/2nd
                  // must resolve to numbers
                  let num = 0;
                  const args = command.$group[key].$max.$divide;
                  for (let i = 0; i < docs.length; i++) {
                    if (args[1] == 0 || docs[i][args[1].substring(1)] == 0) {
                      console.log('dividing would cause a divide by zero error, moving on');
                      continue;
                    }
                    const first = typeof args[0] == 'number' ? args[0] : typeof args[0] == 'string' && typeof docs[i][args[0].substring(1)] == 'number' ? docs[i][args[0].substring(1)] : null;
                    const second = typeof args[1] == 'number' ? args[1] : typeof args[1] == 'string' && typeof docs[i][args[1].substring(1)] == 'number' ? docs[i][args[1].substring(1)] : null;
                    if (first == null || second == null) {
                      continue;
                    }
                    num = first / second;
                    if (num > max) {
                      max = num;
                    }
                  }
                }
              } else { // { $max: "$quantity" }
                for (let i = 0; i < docs.length; i++) {
                  if (docs[i][command.$group[key].$max.substring(1)] > max) {
                    max = docs[i][command.$group[key].$max]
                  }
                }
              }
              maxDoc[key] = max;
              group.push(maxDoc);
            } else {
            
            }
          } else if (checkKey(command.$group[key], '$maxN')) {
            
          } else if (checkKey(command.$group[key], '$mergeObjects')) {
            
          } else if (checkKey(command.$group[key], '$min')) {
            
          } else if (checkKey(command.$group[key], '$push')) {
            for (let i = 0; i < Object.keys(command.$group[key].$push).length; i++) {
              const newObj = {};
            }
            obj[key] = '';
          } else if (checkKey(command.$group[key], '$stdDevPop')) {
            
          } else if (checkKey(command.$group[key], '$stdDevSamp')) {
            
          } else if (checkKey(command.$group[key], '$sum')) {
            
          } else if (checkKey(command.$group[key], '$top')) {
            
          } else if (checkKey(command.$group[key], '$topN')) {
            
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

/* 
  Helper function for aggregation to get all possible values for the given property.
  Doing so allows us to get the total times we'll need to iterate through
  the documents to return documents with the correct identifiers.
*/

function getGroupKeyValues(array, groupId) {
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

// given an object or object property containing an object, and a string to compare against, returns if the string is in the array
// Ex: obj = { $max: "$quantity" } getKeys(obj, "$max") returns true
function checkKey(obj, str) {
  return Object.keys(obj).includes(str);
}

// given the connection, collection name, determines the path type of the property
function getPathType(connection, collectionName, prop) {
  return connection.models[collectionName].schema.paths[prop].instance;
}