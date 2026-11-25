import test from 'node:test'
import assert from 'node:assert/strict'
import {initialShape,initialDocument,validDocument,exportSVG,translateShape} from '../src/core/geometry.ts'
import {shapePath,connect,tangentNode,moveNode,splitEdge,edgePoint,edgeMode,nodeMode,removeNode,geometryPoints,pathBounds,joinNetworks} from '../src/core/network.ts'
import {scaleObject} from '../src/core/objects.ts'
import {parsePath} from '../src/core/svgPath.ts'
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`)
const curve={...initialShape,fill:'none',points:[{x:0,y:0},{x:100,y:0}],edges:[{from:0,to:1,c1:{x:20,y:-50},c2:{x:80,y:50}}],smooth:0}
test('shared nodes support branching, open paths and loops without duplicating their positions',()=>{
 let s={...initialShape,points:[{x:0,y:0},{x:80,y:0},{x:80,y:80},{x:0,y:80}],edges:[],smooth:0,fill:'none'}
 s=connect(connect(connect(s,0,1),1,2),1,3)
 assert.equal(s.edges.length,3);assert.equal(s.points.length,4);assert.match(shapePath(s),/M 80 0 L 0 80/)
 const moved=moveNode(s,1,{x:90,y:10});assert.match(shapePath(moved),/90 10/);assert.equal(moved.points.length,4)
 assert.ok(validDocument({...initialDocument,shapes:[s]}))
})
test('pen tangents create cubic edges, and straight/curve conversion is local',()=>{
 let s={...initialShape,fill:'none',points:[{x:0,y:0}],edges:[],smooth:0}
 s=tangentNode(s,0,{x:30,y:-30});s=connect({...s,points:[...s.points,{x:100,y:0}],tangents:[...s.tangents,{x:0,y:0}]},0,1)
 assert.ok(s.edges[0].c1);assert.match(shapePath(s),/ C /)
 assert.equal(edgeMode(s,0,false).edges[0].c1,undefined)
 assert.ok(edgeMode(edgeMode(s,0,false),0,true).edges[0].c1)
})
test('Bézier splitting preserves the curve exactly through de Casteljau subdivision',()=>{
 const result=splitEdge(curve,0,.37),s=result.shape
 assert.equal(s.points.length,3);assert.equal(s.edges.length,2)
 for(let i=0;i<=20;i++){const t=i/20,expected=edgePoint(curve,curve.edges[0],t),actual=t<=.37?edgePoint(s,s.edges[0],t/.37):edgePoint(s,s.edges[1],(t-.37)/.63);near(actual.x,expected.x);near(actual.y,expected.y)}
})
test('node moves keep handles attached, while resize/translation transform the full geometry',()=>{
 const moved=moveNode(curve,0,{x:10,y:20});assert.deepEqual(moved.edges[0].c1,{x:30,y:-30});assert.deepEqual(moved.edges[0].c2,curve.edges[0].c2)
 const translated=translateShape(curve,{x:100,y:200});assert.deepEqual(translated.edges[0].c1,{x:120,y:150})
 const scaled=scaleObject(curve,{x:0,y:0},2,2);assert.deepEqual(scaled.edges[0].c1,{x:40,y:-100})
})
test('node deletion removes connected edges and safely remaps the rest',()=>{
 const s={...initialShape,edges:[{from:0,to:1},{from:1,to:2},{from:2,to:3},{from:3,to:0}]},removed=removeNode(s,1)
 assert.deepEqual(removed.edges,[{from:1,to:2},{from:2,to:0}]);assert.equal(removed.points.length,3)
 assert.deepEqual(nodeMode(curve,0,false).edges[0].c1,curve.points[0]);assert.deepEqual(nodeMode(curve,0,false).edges[0].c2,curve.edges[0].c2)
})
test('validation accepts a pen starting point, rejects malformed edges and preserves vector export',()=>{
 assert.ok(validDocument({...initialDocument,shapes:[{...initialShape,points:[{x:0,y:0}],edges:[],fill:'none'}]}))
 for(const bad of [{from:0,to:4},{from:0,to:1,c1:{x:1,y:2}},{from:0,to:0},{from:0,to:1,c1:{x:9000,y:0},c2:{x:2,y:2}}])assert.equal(validDocument({...initialDocument,shapes:[{...curve,edges:[bad]}]}),false)
 const svg=exportSVG({...initialDocument,shapes:[curve]},300,200);assert.match(svg,/ C /);assert.match(svg,/fill="none"/);assert.ok(!svg.includes('<image'))
})
test('SVG parser supports relative lines, smooth cubics, quadratic curves, arcs, transforms and holes',()=>{
 const parsed=parsePath('m0 0 h20 v20 h-20 z M40 0 q10 20 20 0 t20 0 M100 0 a10 10 0 0 1 20 0')
 assert.ok(parsed.edges.some(e=>e.c1));assert.ok(parsed.points.length>8)
 const transformed=parsePath('M0 0 L10 0',['translate(10 20)','scale(2)']);assert.deepEqual(transformed.points,[{x:10,y:20},{x:30,y:20}])
 const hole={...initialShape,...parsePath('M0 0 H100 V100 H0 Z M25 25 H75 V75 H25 Z'),fillRule:'evenodd'}
 assert.equal((shapePath(hole).match(/Z/g)||[]).length,2)
 assert.match(exportSVG({...initialDocument,shapes:[hole]},200,200),/fill-rule="evenodd"/)
 const close=parsePath('M0 0 C10 0 10 10 0 0 Z');assert.equal(close.points.length,1);assert.equal(close.edges.length,1);assert.ok(validDocument({...initialDocument,shapes:[{...initialShape,...close}]}))
})
test('network handles contribute to culling and clamp at workspace limits',()=>{
 const translated=translateShape(curve,{x:1990,y:0});assert.ok(geometryPoints(translated).every(p=>p.x<=2000))
 const moved=moveNode({...curve,points:[{x:1980,y:0},curve.points[1]],edges:[{...curve.edges[0],c1:{x:1990,y:-50}}]},0,{x:2000,y:0});assert.equal(moved.points[0].x,1990);assert.equal(moved.edges[0].c1.x,2000)
})

test('exact SVG bounds use cubic extrema rather than the control hull',()=>{
 const shape={...curve,points:[{x:0,y:0},{x:100,y:0}],edges:[{from:0,to:1,c1:{x:0,y:100},c2:{x:100,y:100}}]}
 const bounds=pathBounds(shape);near(bounds.x,0);near(bounds.y,0);near(bounds.w,100);near(bounds.h,75)
})

test('joining separate objects remaps nodes, preserves both geometries and uses starting paint',()=>{
 const other={...curve,id:'other',fill:'#ff0000'},result=joinNetworks(curve,1,other,0)
 assert.ok(result);assert.equal(result.shape.points.length,4);assert.equal(result.shape.edges.length,3);assert.equal(result.shape.fill,'none');assert.equal(result.shape.edges[1].from,2);assert.deepEqual(result.shape.edges[1].c1,other.edges[0].c1);assert.equal(joinNetworks(curve,1,{...other,layerId:'other-layer'},0),null)
})

test('user-space imported gradients follow object moves and scaling',()=>{
 const shape={...curve,fillGradient:{type:'linear',units:'userSpaceOnUse',angle:0,geometry:{x1:0,y1:0,x2:100,y2:0},stops:[{offset:0,color:'#000000'},{offset:1,color:'#ffffff'}]}}
 const moved=translateShape(shape,{x:50,y:20});assert.deepEqual(moved.fillGradient.transform,[1,0,0,1,50,20]);const scaled=scaleObject(shape,{x:0,y:0},2,2);assert.deepEqual(scaled.fillGradient.transform,[2,0,0,2,0,0])
 assert.ok(validDocument({...initialDocument,shapes:[moved]}))
})
