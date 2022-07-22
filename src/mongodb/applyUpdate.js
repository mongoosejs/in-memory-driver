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
        const existing = arr.find(el => el === update.$addToSet[key]);
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
      const initial = mpath.get(key, obj);
      mpath.set(key, update.$inc[key] + initial, obj);
    }
  }
  if (update.$min) {
    for (const key of Object.keys(update.$min)) {
      const initial = mpath.get(key, obj);
      if (initial > update.$min[key] || initial == null) {
        mpath.set(key, update.$min[key], obj);
      }
    }
  }
  if (update.$max) {
    for (const key of Object.keys(update.$max)) {
      const initial = mpath.get(key, obj);
      if (initial < update.$max[key] || initial == null) {
        mpath.set(key, update.$max[key], obj);
      }
    }
  }
  if (update.$mul) {
    for (const key of Object.keys(update.$mul)) {
      const initial = mpath.get(key, obj);
      if (initial == null) {
        mpath.set(key, 0, obj);
      } else {
        mpath.set(key, update.$mul[key] * initial, obj);
      }
    }
  }
  if (update.$rename) {
    for (const key of Object.keys(update.$rename)) {

      const exists = mpath.get(update.$rename[key], obj);
      if (exists) {
        mpath.unset(update.$rename[key], obj);
      }
      const value = mpath.get(key, obj);
      if (value == update.$rename[key] || value == null) continue;
      mpath.unset(key, obj);
      mpath.set(update.$rename[key], value, obj);
    }
  }
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      mpath.unset(key, obj);
    }
  }
};
