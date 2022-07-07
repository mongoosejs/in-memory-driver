'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

mongoose.setDriver(require('../'));

describe('in-memory driver', function() {
  before(async function connect() {
    await mongoose.connect('mongodb://localhost:27017/test');
  });

  after(async function disconnect() {
    await mongoose.disconnect();
  });

  afterEach(async function cleanModels() {
    await Promise.all(Object.values(mongoose.connection.models).map(M => M.deleteMany({})));
    mongoose.deleteModel(/.*/);
    delete mongoose.models.Test;
  });
  
  it('find', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({ name: String }));

    await Test.create([{ name: 'test' }, { name: 'test2' }]);

    let docs = await Test.find({ name: 'test' });
    assert.equal(docs.length, 1);
    assert.equal(docs[0].name, 'test');

    docs = await Test.find({ name: 'test2' });
    assert.equal(docs.length, 1);
    assert.equal(docs[0].name, 'test2');

    docs = await Test.find({}).sort({ name: -1 });
    assert.equal(docs.length, 2);
    assert.equal(docs[0].name, 'test2');
    assert.equal(docs[1].name, 'test');
  });

  it('findOne', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({ name: String }));

    await Test.create([{ name: 'test' }, { name: 'test2' }]);

    let doc = await Test.findOne({ name: 'test' });
    assert.equal(doc.name, 'test');

    doc = await Test.findOne({ name: 'test2' });
    assert.equal(doc.name, 'test2');
  });
});