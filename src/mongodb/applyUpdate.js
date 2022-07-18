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
  if (update.$inc) {
    for (const key of Object.keys(update.$inc)) {
      let initial = mpath.get(key, obj);
      mpath.set(key, update.$inc[key]+initial, obj);
    }
  }
  if (update.$min) {
    for (const key of Object.keys(update.$min)) {
      let initial = mpath.get(key, obj);
      if (initial > update.$min[key] || initial == null) {
        mpath.set(key, update.$min[key], obj);
      }
    }
  }
  if (update.$max) {
    for (const key of Object.keys(update.$max)) {
      let initial = mpath.get(key, obj);
      if (initial < update.$max[key] || initial == null) {
        mpath.set(key, update.$max[key], obj);
      }
    }
  }
  if (update.$mul) {
    for (const key of Object.keys(update.$mul)) {
      let initial = mpath.get(key, obj);
      if (initial == null) {
        mpath.set(key, 0, obj);
      } else {
        mpath.set(key, update.$mul[key]*initial, obj);
      }
    }
  }
  if (update.$rename) {
    for (const key of Object.keys(update.$rename)) {
      // need to search for nested keys
      const exists = Object.keys(obj).find((item) => item == update.$rename[key]);
      if (exists) {
        // need to check this will delete dotted paths
        delete obj[exists];
      }
      let initial = mpath.get(key, obj);
      if (initial == update.$rename[key] || initial == null) continue;
      let value = obj[key];
      mpath.unset(key, obj);
      mpath.unset(update.$rename[key], obj);
      mpath.set(update.$rename[key], value, obj);
    }
  }
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      // need to check for nested paths and arrays
      if (typeof update.$unset[key] == 'object' && update.$unset[key] != null) {
        update.$unset = update.$unset[key];
        return applyUpdate(obj[key], update)
      }
      return mpath.unset(key, obj);
    }
  }
};