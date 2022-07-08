'use strict';

const mpath = require('mpath');

module.exports = function applyUpdate(obj, update) {
  if (update.$set != null) {
    for (const key of Object.keys(update.$set)) {
      mpath.set(key, update.$set[key], obj);
    }
  }
  if (update.$addToSet != null) {
    for (const key of Object.keys(update.$addToSet)) {
      const arr = mpath.get(key, obj);
      if (Array.isArray(arr)) {
        let existing = arr.find(el => el === update.$addToSet[key]);
        if (existing) {
          continue;
        }
        arr.push(update.$addToSet[key]);
      } else {
        mpath.set(key, [update.$addToSet[key]], obj);
      }
    }
  }
  if (update.$push != null) {
    for (const key of Object.keys(update.$push)) {
      const arr = mpath.get(key, obj);
      if (Array.isArray(arr)) {
        arr.push(update.$push[key]);
      } else {
        mpath.set(key, [update.$push[key]], obj);
      }
    }
  }
};