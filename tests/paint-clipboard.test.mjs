import test from 'node:test'
import assert from 'node:assert/strict'
import {initialDocument,initialShape,validDocument,exportSVG} from '../src/core/geometry.ts'
import {validGradient,gradientEndpoints} from '../src/core/paint.ts'
import {copyTarget,pasteTarget,readClipboard} from '../src/core/clipboard.ts'
import {history,reducer} from '../src/core/history.ts'
import {tailwind} from '../src/core/palettes.ts'
const gradient={type:'linear',angle:32.125,stops:[{color:'#ef4444',offset:0},{color:'#3b82f6',offset:1}]}
let sequence=0;const id=()=>`copy-${++sequence}`
test('gradients validate safe colors, sorted stops and bounded angles; old documents still validate',()=>{
 assert.ok(validDocument(initialDocument));assert.ok(validGradient(gradient))
 for(const bad of [{...gradient,angle:NaN},{...gradient,stops:[]},{...gradient,stops:[{color:'url(https://x)',offset:0},{color:'#ffffff',offset:1}]},{...gradient,stops:[{color:'#000000',offset:1},{color:'#ffffff',offset:0}]}])assert.equal(validGradient(bad),false)
 assert.equal(validDocument({...initialDocument,backgroundGradient:{...gradient,angle:999}}),false)
})
test('SVG retains vector gradients for fills, strokes and background under repeat transforms',()=>{
 const doc={...initialDocument,backgroundGradient:{...gradient,type:'radial'},shapes:[{...initialShape,fillGradient:gradient,strokeGradient:gradient}]}
 assert.ok(validDocument(doc));const svg=exportSVG(doc,800,300)
 assert.match(svg,/<linearGradient id="fill-0"/);assert.match(svg,/fill="url\(#fill-0\)"/);assert.match(svg,/stroke="url\(#stroke-0\)"/);assert.match(svg,/<radialGradient id="background-paint"/);assert.match(svg,/fill="url\(#background-paint\)"/);assert.ok(!svg.includes('<image'))
 assert.equal(gradientEndpoints(0).x1,0);assert.equal(gradientEndpoints(0).x2,1)
})
test('copy/paste preserves independent geometry, gradients and stacking; undo is one action',()=>{
 const doc={...initialDocument,shapes:[{...initialShape,fillGradient:gradient}]},data=copyTarget(doc,{kind:'object',id:initialShape.id})
 assert.ok(readClipboard(JSON.stringify(data)));assert.equal(readClipboard('ordinary text'),null)
 const result=pasteTarget(doc,data,'layer-1',id)
 assert.equal(result.doc.shapes.length,2);assert.notEqual(result.target.id,initialShape.id);assert.equal(result.doc.shapes[1].points[0].x,initialShape.points[0].x+20)
 result.doc.shapes[1].fillGradient.stops[0].color='#000000'
 assert.equal(doc.shapes[0].fillGradient.stops[0].color,'#ef4444');assert.equal(data.shapes[0].fillGradient.stops[0].color,'#ef4444')
 const state=reducer(history(doc),{type:'edit',update:()=>result.doc});assert.equal(reducer(state,{type:'undo'}).present.shapes.length,1)
})
test('layer copying includes its objects with fresh membership and an independent gradient',()=>{
 const data=copyTarget(initialDocument,{kind:'layer',id:'layer-1'}),result=pasteTarget(initialDocument,data,'layer-1',id)
 assert.equal(result.doc.layers.length,2);assert.equal(result.target.kind,'layer');assert.equal(result.doc.shapes[1].layerId,result.target.id)
 assert.notEqual(result.doc.shapes[1].id,initialShape.id)
})
test('paste respects locked destinations, document limits and shared layer offset at bounds',()=>{
 const data=copyTarget(initialDocument,{kind:'object',id:initialShape.id})
 assert.equal(pasteTarget({...initialDocument,layers:[{...initialDocument.layers[0],locked:true}]},data,'layer-1',id),null)
 assert.equal(pasteTarget({...initialDocument,shapes:Array.from({length:64},(_,i)=>({...initialShape,id:`s${i}`}))},data,'layer-1',id),null)
 const doc={...initialDocument,shapes:[{...initialShape,id:'a',points:initialShape.points.map(p=>({...p,x:p.x+1945}))},{...initialShape,id:'b'}]}
 const result=pasteTarget(doc,copyTarget(doc,{kind:'layer',id:'layer-1'}),'layer-1',id)
 assert.equal(result.doc.shapes[2].points[0].x-doc.shapes[0].points[0].x,5)
 assert.equal(result.doc.shapes[3].points[0].x-doc.shapes[1].points[0].x,5)
})
test('Tailwind defaults use official 500 hex values and include complete shade families',()=>{
 assert.equal(tailwind.red['500'],'#ef4444');assert.equal(tailwind.blue['500'],'#3b82f6');assert.equal(Object.keys(tailwind).length,22)
 assert.equal(Object.keys(tailwind.blue).length,11)
})
