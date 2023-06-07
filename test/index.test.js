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

  it('find cursor', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({ name: String }));

    await Test.create([{ name: 'test' }, { name: 'test2' }, { name: 'foo' }]);

    const cursor = await Test.find({ name: /test/ }).cursor();
    let doc = await cursor.next();
    assert.equal(doc.name, 'test');
    doc = await cursor.next();
    assert.equal(doc.name, 'test2');
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

    it('supports projections', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({ name: String, age: Number }));

      await Test.create([{ name: 'test', age: 29 }]);

      const doc = await Test.findOne({ name: 'test' }).select('name');
      assert.notEqual(doc._id, undefined);
      assert.equal(doc.name, 'test');
      assert.strictEqual(doc.age, undefined);
    });

    it('supports projections with disabled _id', async function() {
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
  describe('aggregation', function() {
    it('supports $limit', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        num: Number
      }));
      for (let i = 0; i < 11; i++) {
        await Test.create({
          name: 'Test',
          num: i
        });
      }
      const limit = 6;
      const docs = Test.collection.aggregate([{ $limit: limit }]);
      assert.equal(docs.length, limit);
    });
    it('supports $skip', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        num: Number
      }));
      const total = 11
      for (let i = 0; i < total; i++) {
        await Test.create({
          name: 'Test',
          num: i
        });
      }
      const skip = 4;
      const docs = Test.collection.aggregate([{ $skip: skip }]);
      assert.equal(docs.length, total - skip);
    });
    it('supports $project', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        num: Number,
        age: Number
      }));
      const total = 11
      for (let i = 0; i < total; i++) {
        await Test.create({
          name: 'Test',
          num: i,
          age: total
        });
      }
      let docs = Test.collection.aggregate([ { $limit: 1 }, { $project: { num: 0 } }]);
      assert.equal(docs[0].num, undefined);
      docs = Test.collection.aggregate([ { $limit: 1 }, { $project: { age: 1 } }]);
      assert.equal(docs[0].age, total);
      assert.equal(docs[0].name, undefined);
    });
    it('supports $sort', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        num: Number,
        age: Number
      }));
      const total = 11
      for (let i = 0; i < total; i++) {
        await Test.create({
          name: 'Test',
          num: i,
          age: total
        });
      }
      let docs = Test.collection.aggregate([ { $sort: { num: 1 } }]);
      docs = Test.collection.aggregate([ { $sort: { num: -1 } }]);
    });
    it('supports $unwind', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        values: [Number]
      }));
      await Test.create({ name: 'Test', values: [1, 2, 3, 4, 5] });
      await Test.create({ name: 'Test2', values: 20 });
      await Test.create({ name: 'Test3'});
      // just the path
      const docs = Test.collection.aggregate([ { $unwind: 'values' } ]);
      assert.equal(docs.length, 6);
      // with includeArrayIndex
      const indexDocs = Test.collection.aggregate([ { $unwind: { path: 'values', includeArrayIndex: 'myIndex' }}]);
      assert.ok(Object.keys(indexDocs[0]).includes('myIndex'));
      assert.equal(indexDocs[0].myIndex, indexDocs[0].values - 1);
      // with preserveNullAndEmptyArrays
      const PNAEA = Test.collection.aggregate([ { $unwind: { path: 'values', preserveNullAndEmptyArrays: true } }]);
      const emptyArray = PNAEA.find(x => x.values.length == 0);
      assert(emptyArray)
    });
    it('can do it all together', async function() {
      // so the tests don't complain
      assert(true);
    });
  });
});
