'use strict';

module.exports = function countAccumulator(inputDocs, outputDocs, groupField, key) {
  for (const doc of inputDocs) {
    let groupForDoc = outputDocs.find(g => g._id === doc[groupField]);
    if (groupForDoc == null) {
      groupForDoc = { _id: doc[groupField], [key]: 0 };
      outputDocs.push(groupForDoc);
    }
    groupForDoc[key]++;
  }
};
