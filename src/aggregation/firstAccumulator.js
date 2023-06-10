'use strict';

module.exports = function firstAccumulator(inputDocs, outputDocs, groupField, key, value) {
  value = value.slice(1);
  for (const doc of inputDocs) {
    let groupForDoc = outputDocs.find(g => g._id === doc[groupField]);
    if (groupForDoc == null) {
      groupForDoc = { _id: doc[groupField], [key]: [] };
      outputDocs.push(groupForDoc);
    }
    groupForDoc[key].push(doc[value]);
  }
  for (const groupForDoc of outputDocs) {
    groupForDoc[key] = groupForDoc[key][0];
  }
}