'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

mongoose.setDriver(require('../'));


describe('$operators', function() {
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
  
  it('$inc', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({ name: String, value: Number }));

    const entry = await Test.create({ name: 'test', value: 1 });

    await Test.updateOne({_id: entry._id}, {$inc: { value: 2}});

    const result = await Test.findOne();

    assert.equal(3, result.value);
  });

  it('$min', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({ name: String, value: Number }));

    const noUpdate = await Test.create({ name: 'test', value: 1 });

    await Test.updateOne({_id: noUpdate._id}, {$min: { value: 2}});

    let result = await Test.findOne();

    assert.equal(1, result.value);

    const update = await Test.create({ name: 'Should decrease', value: 3 });

    await Test.updateOne({ _id: update._id }, {$min: { value: 2 }});

    result = await Test.findById({ _id: update._id });
    
    assert.equal(2, result.value);

    const insertValue = await Test.create({ name: 'Should insert 2'});

    await Test.updateOne({ _id: insertValue._id }, {$min: { value: 2 }});

    result = await Test.findById({ _id: insertValue._id });
    assert.equal(2, result.value);
  });

  it('$max', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({ name: String, value: Number }));

    const noUpdate = await Test.create({ name: 'test', value: 1 });

    await Test.updateOne({_id: noUpdate._id}, {$max: { value: 2}});

    let result = await Test.findOne();

    assert.equal(2, result.value);

    const update = await Test.create({ name: 'Should decrease', value: 3 });

    await Test.updateOne({ _id: update._id }, {$max: { value: 2 }});

    result = await Test.findById({ _id: update._id });
    
    assert.equal(3, result.value);

    const insertValue = await Test.create({ name: 'Should insert 2'});

    await Test.updateOne({ _id: insertValue._id }, {$max: { value: 2 }});

    result = await Test.findById({ _id: insertValue._id });
    assert.equal(2, result.value);
  });

  it('$mul', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({ name: String, value: Number }));

    const multiply = await Test.create({ name: 'test', value: 1 });

    await Test.updateOne({_id: multiply._id}, {$mul: { value: 2}});

    let result = await Test.findOne();

    assert.equal(2, result.value);

    const insertValue = await Test.create({ name: 'Should insert 0'});

    await Test.updateOne({ _id: insertValue._id }, {$mul: { value: 2 }});

    result = await Test.findById({ _id: insertValue._id });
    assert.equal(0, result.value);
  });

  it('$rename', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({ name: String }));

    const willRename = await Test.create({ name: 'test' });

    await Test.updateOne({_id: willRename._id}, {$rename: { name: 'displayName'}});

    let result = await Test.findOne();
    const keys = Object.keys(result._doc);
    const newKey = keys.find((item) => item == 'displayName');
    const oldKey = keys.find((item) => item == 'name');
    assert(newKey);
    assert(!oldKey);

    const newModel = mongoose.model('newModel', mongoose.Schema({ name: String, displayName: String }));

    const fieldExists = await newModel.create({ name: 'Test', displayName: 'Test Testerson'});

    await newModel.updateOne({ _id: fieldExists }, {$rename: { name: 'displayName' }});

    result = await newModel.findOne();
    assert.equal(result.displayName, 'Test');

    const Nested = mongoose.model('Nested', mongoose.Schema({ title: String, displayName: { name: String, gamerTag: String } }));

    const nested = await Nested.create({ 
      title: 'Nested Test',
      displayName: { name: 'Quiz', gamerTag: 'zicle'}
    });

    await Nested.updateOne({ _id: nested._id }, {$rename: {"displayName.name": "displayName.title"}});

    result = await Nested.findOne();

    console.log(result);
    assert.equal(result.title, 'Nested Test');
    assert(result.displayName.title);
    assert.equal(result.displayName.title, 'Quiz');


  });

  it('$unset', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({ name: String, value: Number }));

    const unset = await Test.create({ name: 'test', value: 1 });

    await Test.updateOne({_id: unset._id}, {$unset: { value: 2}});

    let result = await Test.findOne();
    assert.equal(result.value, undefined);

    const Nested = mongoose.model('Nested', mongoose.Schema({ name: String, displayName: {prefix: String, suffix: String}}));

    const nested = await Nested.create({ name: 'Test Testerson', displayName: {prefix: 'Quiz', suffix: 'zicle'}});

    await Nested.updateOne({ _id: nested._id }, {$unset: {"displayName.suffix": 1}});

    result = await Nested.findOne();
    assert(result.displayName);
    assert.equal(result.displayName.suffix, undefined);

    const arrayModel = mongoose.model('Array', mongoose.Schema({ name: String, array: [], nestedArray: {
      stack: []
    }}));

    const arrayStrings = await arrayModel.create({ name: 'Array Test', array: ['Hello']});

    await arrayModel.updateOne({ _id: arrayStrings }, { $unset: {array: 1 }});

    result = await arrayModel.findOne();

    assert.equal(result.array.length, 0);

    const nestedArray = await arrayModel.create({ name: 'Last Test', array: ['Goodbye'], nestedArray: {
      stack: ['Farewell']
    }});

    await arrayModel.updateOne({ _id: nestedArray._id }, { $unset: {"nestedArray.stack": 1} });

    result = await arrayModel.findById({ _id: nestedArray._id});

    assert.equal(result.nestedArray.stack.length, 0);

  });
});