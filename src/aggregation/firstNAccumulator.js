'use strict';

module.exports = function firstNAccumulator(inputDocs, outputDocs, groupField, key, value) {
  const input = value.input.slice(1);
  const n = value.n;
  for (const doc of inputDocs) {
    let groupForDoc = outputDocs.find(g => g._id === doc[groupField]);
    if (groupForDoc == null) {
      groupForDoc = { _id: doc[groupField], [key]: [] };
      outputDocs.push(groupForDoc);
    }
    if (groupForDoc[key].length < n) {
      groupForDoc[key].push(doc[input]);
    }
  }
  for (const groupForDoc of outputDocs) {
    groupForDoc[key] = groupForDoc[key].slice(0, n);
  }
};
