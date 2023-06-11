'use strict';

const sort = require('../mongodb/sort');

module.exports = function bottomAccumulator(inputDocs, outputDocs, groupField, key, value) {
  const output = value.output.slice(1);
  const sortBy = value.sortBy;
  for (const doc of inputDocs) {
    let groupForDoc = outputDocs.find(g => g._id === doc[groupField]);
    if (groupForDoc == null) {
      groupForDoc = { _id: doc[groupField], [key]: [] };
      outputDocs.push(groupForDoc);
    }
    groupForDoc[key].push(doc[output]);
  }
  for (const groupForDoc of outputDocs) {
    groupForDoc[key] = groupForDoc[key].sort(sort(sortBy)).slice(0, 1);
  }
};

