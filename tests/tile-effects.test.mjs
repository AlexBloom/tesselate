import test from 'node:test'
import assert from 'node:assert/strict'
import {initialDocument,tileOptions,effectiveTile,tileInstance,exportSVG,validDocument,migrateDocument} from '../src/core/geometry.ts'
import {history,reducer} from '../src/core/history.ts'
const on={enabled:true,rotation:true,mirror:true,offset:true}
const configured={...initialDocument,angle:30,rotationStep:60,flipX:true,mirror:true,offsetX:24,offsetY:8,tileOptions:on}
test('optional tile effects bypass stored transforms without discarding their values',()=>{
  const off={...configured,tileOptions:{...on,enabled:false}}
  assert.deepEqual(effectiveTile(off),{angle:0,rotationStep:0,flipX:false,flipY:false,mirror:false,offsetX:0,offsetY:0})
  assert.deepEqual(tileInstance(off,1,0).matrix,tileInstance(initialDocument,1,0).matrix)
  assert.equal(off.rotationStep,60);assert.equal(off.offsetX,24)
  assert.deepEqual(tileInstance({...off,tileOptions:on},1,0).matrix,tileInstance(configured,1,0).matrix)
})
test('rotation, mirror, and offset switches independently control evaluated content',()=>{
  const doc={...configured,tileOptions:{enabled:true,rotation:false,mirror:true,offset:false}}
  assert.deepEqual(effectiveTile(doc),{angle:0,rotationStep:0,flipX:true,flipY:false,mirror:true,offsetX:0,offsetY:0})
  assert.notDeepEqual(tileInstance(doc,0,0).matrix,tileInstance(configured,0,0).matrix)
})
test('existing documents infer active effects and preserve their rendered appearance',()=>{
  const {tileOptions:_,...legacy}=configured
  assert.deepEqual(tileOptions(legacy),on)
  assert.deepEqual(tileInstance(legacy,1,0).matrix,tileInstance(configured,1,0).matrix)
  assert.equal(tileOptions(initialDocument).enabled,false)
  assert.deepEqual(migrateDocument(legacy),legacy)
})
test('toggle state and title persist in a valid document and effect switches undo together',()=>{
  const doc={...configured,title:'Evening pattern'}
  assert.ok(validDocument(doc));assert.ok(!validDocument({...doc,title:12}));assert.ok(!validDocument({...doc,tileOptions:{enabled:false}}))
  let state=history(doc)
  state=reducer(state,{type:'edit',update:d=>({...d,tileOptions:{...on,enabled:false}})})
  const svg=exportSVG(state.present,600,400)
  assert.equal(svg,exportSVG({...initialDocument,title:'Evening pattern',tileOptions:{...on,enabled:false}},600,400))
  state=reducer(state,{type:'undo'});assert.deepEqual(state.present,doc)
})
