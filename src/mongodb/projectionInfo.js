'use strict';

module.exports = function projectionInfo(projection) {
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
};
