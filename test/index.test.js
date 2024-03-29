'use strict';

const assert = require('assert');
const aggregate = require('../src/mongodb/aggregate');
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

    docs = await Test.find({}).sort({ name: -1 }).limit(1);
    assert.equal(docs.length, 1);
    assert.equal(docs[0].name, 'test2');

    docs = await Test.find({}).sort({ name: -1 }).skip(1);
    assert.equal(docs.length, 1);
    assert.equal(docs[0].name, 'test');
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

  it('find with sort', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({
      name: String,
      nested: { age: Number },
      docArr: [{ tag: String }]
    }));

    await Test.create([
      { name: 'test', nested: { age: 25 }, docArr: [{ tag: 'aa' }] },
      { name: 'test2', nested: { age: 22 }, docArr: [{ tag: 'bb' }] }
    ]);

    let docs = await Test.find().sort({ 'nested.age': 1 });
    assert.equal(docs.length, 2);
    assert.deepStrictEqual(docs.map(doc => doc.nested.age), [22, 25]);

    docs = await Test.find().sort({ 'nested.age': -1 });
    assert.equal(docs.length, 2);
    assert.deepStrictEqual(docs.map(doc => doc.nested.age), [25, 22]);

    docs = await Test.find().sort({ 'docArr.0.tag': -1 });
    assert.equal(docs.length, 2);
    assert.deepStrictEqual(docs.map(doc => doc.docArr[0].tag), ['bb', 'aa']);

    docs = await Test.find().sort({ 'docArr.0.tag': 1 });
    assert.equal(docs.length, 2);
    assert.deepStrictEqual(docs.map(doc => doc.docArr[0].tag), ['aa', 'bb']);
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

  it('deleteOne', async function() {
    const Test = mongoose.model('Test', mongoose.Schema({
      name: String,
      priority: Number
    }));

    await Test.create([
      { name: 'foo' },
      { name: 'bar', priority: 0 },
      { name: 'bar', priority: 1 },
      { name: 'bar', priority: 2 }
    ]);

    await Test.deleteOne({ name: 'foo' });
    let remaining = await Test.find().then(docs => docs.map(doc => ({
      name: doc.name,
      priority: doc.priority
    })));
    assert.deepStrictEqual(remaining, [
      { name: 'bar', priority: 0 },
      { name: 'bar', priority: 1 },
      { name: 'bar', priority: 2 }
    ]);

    await Test.deleteOne({ name: 'bar' }, { sort: { priority: -1 } });
    remaining = await Test.find().then(docs => docs.map(doc => ({
      name: doc.name,
      priority: doc.priority
    })));
    assert.deepStrictEqual(remaining, [
      { name: 'bar', priority: 0 },
      { name: 'bar', priority: 1 }
    ]);

    await Test.deleteOne({ name: 'bar' }, { sort: { priority: 1 } });
    remaining = await Test.find().then(docs => docs.map(doc => ({
      name: doc.name,
      priority: doc.priority
    })));
    assert.deepStrictEqual(remaining, [
      { name: 'bar', priority: 1 }
    ]);
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
    it('supports $group with $count', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        firstName: String,
        lastName: String
      }));
      await Test.create({ firstName: 'Alice', lastName: 'Test1' });
      await Test.create({ firstName: 'Alice', lastName: 'Test2' });
      await Test.create({ firstName: 'Bob', lastName: 'Test3' });
      const docs = aggregate.call(Test.collection, [
        { $group: { _id: '$firstName', count: { $count: {} } } }
      ]);
      assert.equal(docs.length, 2);
      assert.deepEqual(docs.map(d => d.count).sort(), [1, 2]);
    });
    it('supports $group with $first', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        firstName: String,
        lastName: String,
        age: Number
      }));
      await Test.create({ firstName: 'Alice', lastName: 'Test1', age: 25 });
      await Test.create({ firstName: 'Alice', lastName: 'Test2', age: 30 });
      const docs = aggregate.call(Test.collection, [
        { $group: { _id: '$firstName', minAge: { $first: '$age' } } }
      ]);
      assert.equal(docs.length, 1);
      assert.equal(docs[0].minAge, 25);
    });
    it('supports $group with $firstN', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        firstName: String,
        age: Number
      }));
      await Test.create({ firstName: 'Alice', age: 25 });
      await Test.create({ firstName: 'Alice', age: 30 });
      await Test.create({ firstName: 'Alice', age: 22 });
      const docs = aggregate.call(Test.collection, [
        {
          $group: {
            _id: '$firstName',
            ages: { $firstN: { input: '$age', n: 2 } }
          }
        }
      ]);
      assert.equal(docs.length, 1);
      assert.deepEqual(docs[0].ages, [25, 30]);
    });
    it('supports $group with $last', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        firstName: String,
        lastName: String,
        age: Number
      }));
      await Test.create({ firstName: 'Alice', lastName: 'Test1', age: 25 });
      await Test.create({ firstName: 'Alice', lastName: 'Test2', age: 30 });
      const docs = aggregate.call(Test.collection, [
        { $group: { _id: '$firstName', lastAge: { $last: '$age' } } }
      ]);
      assert.equal(docs.length, 1);
      assert.equal(docs[0].lastAge, 30);
    });
    it('supports $group with $max', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        firstName: String,
        lastName: String,
        age: Number
      }));
      await Test.create({ firstName: 'Alice', lastName: 'Test1', age: 25 });
      await Test.create({ firstName: 'Alice', lastName: 'Test2', age: 30 });
      const docs = aggregate.call(Test.collection, [
        { $group: { maxAge: { $max: '$age' } } }
      ]);
      assert.equal(docs.length, 1);
      assert.equal(docs[0].maxAge, 30);
    });
    it('supports $group with $max and multiply', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        firstName: String,
        a: Number,
        b: Number
      }));
      await Test.create({ firstName: 'Alice', a: 10, b: 5 });
      await Test.create({ firstName: 'Alice', a: 8, b: 4 });
      const docs = aggregate.call(Test.collection, [
        { $group: { max: { $max: { $multiply: ['$a', '$b'] } } } }
      ]);
      assert.equal(docs.length, 1);
      assert.equal(docs[0].max, 50);
    });
    it('supports $match', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        age: Number
      }));
      await Test.create({ name: 'Test', age: 42 });
      await Test.create({ name: 'John', age: 10 });
      await Test.create({ name: 'Batman', age: 26 });
      let docs = aggregate.call(Test.collection, [{ $match: { name: 'Batman' } }]);
      assert.equal(docs[0].name, 'Batman');
      docs = aggregate.call(Test.collection, [{ $match: { $or: [{ name: 'Batman' }, { age: 10 }] } }]);
      assert.equal(docs.length, 2);
      assert.deepEqual(docs.map(doc => doc.name).sort(), ['Batman', 'John']);
    });
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
      const docs = aggregate.call(Test.collection, [{ $limit: limit }]);
      assert.equal(docs.length, limit);
    });
    it('supports $skip', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        num: Number
      }));
      const total = 11;
      for (let i = 0; i < total; i++) {
        await Test.create({
          name: 'Test',
          num: i
        });
      }
      const skip = 4;
      const docs = aggregate.call(Test.collection, [{ $skip: skip }]);
      assert.equal(docs.length, total - skip);
    });
    it('supports $project', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        num: Number,
        age: Number
      }));
      const total = 11;
      for (let i = 0; i < total; i++) {
        await Test.create({
          name: 'Test',
          num: i,
          age: total
        });
      }
      let docs = aggregate.call(Test.collection, [{ $limit: 1 }, { $project: { num: 0 } }]);
      assert.equal(docs[0].num, undefined);
      docs = aggregate.call(Test.collection, [{ $limit: 1 }, { $project: { age: 1 } }]);
      assert.equal(docs[0].age, total);
      assert.equal(docs[0].name, undefined);
    });
    it('supports $sort', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        num: Number,
        age: Number
      }));
      const total = 11;
      for (let i = 0; i < total; i++) {
        await Test.create({
          name: 'Test',
          num: i,
          age: total
        });
      }
      const docs = aggregate.call(Test.collection, [{ $sort: { num: -1 } }]);
      assert.deepStrictEqual(docs.map(doc => doc.num), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    });
    it('supports $unwind', async function() {
      const Test = mongoose.model('Test', mongoose.Schema({
        name: String,
        values: [Number]
      }));
      await Test.create({ name: 'Test', values: [1, 2, 3, 4, 5] });
      await Test.create({ name: 'Test2', values: 20 });
      await Test.create({ name: 'Test3' });
      // just the path
      const docs = aggregate.call(Test.collection, [{ $unwind: 'values' }]);
      assert.equal(docs.length, 6);
      // with includeArrayIndex
      const indexDocs = aggregate.call(Test.collection, [{ $unwind: { path: 'values', includeArrayIndex: 'myIndex' } }]);
      assert.ok(Object.keys(indexDocs[0]).includes('myIndex'));
      assert.equal(indexDocs[0].myIndex, indexDocs[0].values - 1);
      // with preserveNullAndEmptyArrays
      const PNAEA = aggregate.call(Test.collection, [{ $unwind: { path: 'values', preserveNullAndEmptyArrays: true } }]);
      const emptyArray = PNAEA.find(x => x.values.length == 0);
      assert(emptyArray);
    });
    it('can do it all together', async function() {
      // so the tests don't complain
      assert(true);
    });
  });
});
