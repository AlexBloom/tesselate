import test from 'node:test'
import assert from 'node:assert/strict'
import { initialDocument, initialShape, orderedShapes, exportSVG, updateLayer } from '../src/core/geometry.ts'
import { stack, dropStack, canStack } from '../src/core/stacking.ts'
import { history, reducer } from '../src/core/history.ts'
const layer2={id:'l2',name:'Top',visible:true,locked:false}
const doc={...initialDocument,layers:[...initialDocument.layers,layer2],shapes:[{...initialShape,id:'a',fill:'#112233'},{...initialShape,id:'b',fill:'#223344'},{...initialShape,id:'c',fill:'#334455'},{...initialShape,id:'d',layerId:'l2',fill:'#445566'}]}
const ids=d=>orderedShapes(d).map(s=>s.id)
const target=id=>({kind:'object',id})
test('new documents start with a sharp 100px square',()=>{
 assert.equal(initialShape.smooth,0);assert.deepEqual(initialShape.points,[{x:-50,y:-50},{x:50,y:-50},{x:50,y:50},{x:-50,y:50}])
})
test('forward/backward move one sibling without swapping across intervening objects',()=>{
 assert.deepEqual(ids(stack(doc,target('a'),'forward')),['b','a','c','d'])
 assert.deepEqual(ids(stack(doc,target('c'),'backward')),['a','c','b','d'])
 assert.deepEqual(ids(stack(doc,target('a'),'front')),['b','c','a','d'])
 assert.deepEqual(ids(stack(doc,target('c'),'back')),['c','a','b','d'])
 assert.equal(canStack(doc,target('c'),'front'),false)
 assert.equal(stack(doc,target('missing'),'front'),doc)
})
test('dragging objects and layers interprets above as toward the front',()=>{
 assert.deepEqual(ids(dropStack(doc,target('a'),target('c'),true)),['b','c','a','d'])
 assert.deepEqual(ids(dropStack(doc,target('c'),target('a'),false)),['c','a','b','d'])
 assert.deepEqual(ids(dropStack(doc,{kind:'layer',id:'layer-1'},{kind:'layer',id:'l2'},true)),['d','a','b','c'])
})
test('object drag transfers to another layer at an explicit position; locks block changes',()=>{
 const moved=dropStack(doc,target('a'),target('d'),false)
 assert.deepEqual(ids(moved),['b','c','a','d']);assert.equal(moved.shapes.find(s=>s.id==='a').layerId,'l2')
 const header=dropStack(doc,target('a'),{kind:'layer',id:'l2'})
 assert.deepEqual(ids(header),['b','c','d','a'])
 const locked=updateLayer(doc,'l2',l=>({...l,locked:true}))
 assert.equal(dropStack(locked,target('a'),target('d')),locked)
 assert.equal(stack(locked,target('d'),'back'),locked)
 assert.equal(dropStack(doc,{kind:'layer',id:'l2'},target('a')),doc)
})
test('stacking is one undo operation and SVG follows the same order',()=>{
 const state=reducer(history(doc),{type:'edit',update:d=>stack(d,target('a'),'front')})
 assert.equal(state.past.length,1);assert.deepEqual(ids(reducer(state,{type:'undo'}).present),ids(doc))
 const svg=exportSVG(state.present,400,400)
 assert.ok(svg.indexOf('#223344')<svg.indexOf('#334455'));assert.ok(svg.indexOf('#334455')<svg.indexOf('#112233'));assert.ok(svg.indexOf('#112233')<svg.indexOf('#445566'))
})
