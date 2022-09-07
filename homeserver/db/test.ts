import assert from 'assert/strict'
import {fromSerialized, serialize, createDb, localMapInsert, get, applyRemoteOp} from './index.js'
import { ROOT, ROOT_LV } from './types.js'

let db = createDb()

localMapInsert(db, ['seph', 0], ROOT_LV, 'yo', {type: 'primitive', val: 123})
assert.deepEqual(get(db), {yo: 123})

// ****
db = createDb()
// concurrent changes
applyRemoteOp(db, {
  id: ['mike', 0],
  globalParents: [],
  crdtId: ROOT,
  action: {type: 'map', localParents: [], key: 'c', val: {type: 'primitive', val: 'mike'}},
})
applyRemoteOp(db, {
  id: ['seph', 1],
  globalParents: [],
  crdtId: ROOT,
  action: {type: 'map', localParents: [], key: 'c', val: {type: 'primitive', val: 'seph'}},
})

assert.deepEqual(get(db), {c: 'seph'})

applyRemoteOp(db, {
  id: ['mike', 1],
  // globalParents: [['mike', 0]],
  globalParents: [['mike', 0], ['seph', 1]],
  crdtId: ROOT,
  // action: {type: 'map', localParents: [['mike', 0]], key: 'yo', val: {type: 'primitive', val: 'both'}},
  action: {type: 'map', localParents: [['mike', 0], ['seph', 1]], key: 'c', val: {type: 'primitive', val: 'both'}},
})
// console.dir(db, {depth: null})
assert.deepEqual(get(db), {c: 'both'})

// ****
db = createDb()
// Set a value in an inner map
const [_, inner] = localMapInsert(db, ['seph', 1], ROOT_LV, 'stuff', {type: 'crdt', crdtKind: 'map'})
localMapInsert(db, ['seph', 2], inner, 'cool', {type: 'primitive', val: 'definitely'})
assert.deepEqual(get(db), {stuff: {cool: 'definitely'}})



const serialized = JSON.stringify(serialize(db))
const deser = fromSerialized(JSON.parse(serialized))
assert.deepEqual(db, deser)
