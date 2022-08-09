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

  describe('findOne', function() {
    it('works', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({ name: String }));

      await Test.create([{ name: 'test' }, { name: 'test2' }]);

      let doc = await Test.findOne({ name: 'test' });
      assert.equal(doc.name, 'test');

      doc = await Test.findOne({ name: 'test2' });
      assert.equal(doc.name, 'test2');
    });

    it('supports projections', async function () {
      const Test = mongoose.model('Test', mongoose.Schema({ name: String, age: Number }));

      await Test.create([{ name: 'test', age: 29 }]);

      const doc = await Test.findOne({ name: 'test' }).select('name');
      assert.notEqual(doc._id, undefined);
      assert.equal(doc.name, 'test');
      assert.strictEqual(doc.age, undefined);
    });

    it('supports projections with disabled _id', async function () {
      const Test = mongoose.model('Test', mongoose.Schema({ name: String, age: Number }));

      await Test.create([{ name: 'test', age: 29 }]);

      const doc = await Test.findOne({ name: 'test' }).select('age -_id');
      assert.equal(doc._id, undefined);
      assert.equal(doc.name, undefined);
      assert.strictEqual(doc.age, 29);
    });

  });

  it('updateOne', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({
      name: String,
      tags: [String]
    }));

    const { _id } = await Test.create({ name: 'test', tags: [] });

    await Test.updateOne({ _id }, { $set: { name: 'test2' } });

    let doc = await Test.findOne({ name: 'test2' });
    assert.equal(doc.name, 'test2');

    await Test.updateOne({ _id }, { $push: { tags: 'mongodb' } });

    doc = await Test.findOne({ name: 'test2' });
    assert.deepEqual(doc.tags, ['mongodb']);

    await Test.updateOne({ _id }, { $addToSet: { tags: 'mongodb' } });

    doc = await Test.findOne({ name: 'test2' });
    assert.deepEqual(doc.tags, ['mongodb']);

    await Test.updateOne({ _id }, { $push: { tags: 'javascript' } });

    doc = await Test.findOne({ name: 'test2' });
    assert.deepEqual(doc.tags, ['mongodb', 'javascript']);
  });

  describe('findOneAndUpdate', function() {
    it('handles upsert', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        other: String
      }));
      let doc = await Test.findOneAndUpdate(
        { name: 'test' },
        { other: 'other' },
        { upsert: true }
      );
      assert.ok(doc);
      assert.equal(doc.name, 'test');
      assert.equal(doc.other, 'other');

      doc = await Test.findOne();
      assert.ok(doc);
      assert.equal(doc.name, 'test');
      assert.equal(doc.other, 'other');
    });
  });
});
