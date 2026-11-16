import test from 'node:test'
import assert from 'node:assert/strict'
import {initialDocument,initialShape,initialLayer,addLayer,addShape,updateLayer,removeLayer,moveToLayer,visibleShapes,editableShape,orderedShapes,validDocument,migrateDocument,tileInstance,transformPoint,rotation,matrixText,instances,exportSVG,inversePoint} from '../src/core/geometry.ts'
import {primitivePoints,objectBounds,resizeObject,scaleObject,closestSegment} from '../src/core/objects.ts'
import {history,reducer} from '../src/core/history.ts'
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`)
const rectangle={...initialShape,...primitivePoints('rectangle',100,50)}

test('layers contain several objects; visibility, locking, and stacking are independent',()=>{
  let doc=addShape(initialDocument,{...initialShape,id:'a2'})
  doc=addLayer(doc,{id:'layer-2',name:'Details',visible:true,locked:false})
  doc=addShape(doc,{...initialShape,id:'b1',layerId:'layer-2',fill:'#112233'})
  doc=addShape(doc,{...initialShape,id:'b2',layerId:'layer-2',fill:'#223344'})
  assert.equal(doc.layers.length,2);assert.equal(doc.shapes.length,4)
  assert.deepEqual(orderedShapes(doc).map(s=>s.id),['shape-1','a2','b1','b2'])
  const hidden=updateLayer(doc,'layer-2',l=>({...l,visible:false}))
  assert.deepEqual(visibleShapes(hidden).map(s=>s.id),['shape-1','a2'])
  assert.ok(!exportSVG(hidden,400,400).includes('#112233'))
  const locked=updateLayer(doc,'layer-2',l=>({...l,locked:true}))
  assert.equal(visibleShapes(locked).length,4)
  assert.ok(!editableShape(locked,locked.shapes.at(-1)))
  const reversed={...doc,layers:[...doc.layers].reverse()}
  assert.deepEqual(orderedShapes(reversed).map(s=>s.id),['b1','b2','shape-1','a2'])
})
test('moving objects between layers and deleting a layer preserve undo state',()=>{
  const doc=addLayer(initialDocument,{id:'layer-2',name:'Other',visible:true,locked:false})
  let state=history(doc)
  state=reducer(state,{type:'edit',update:d=>moveToLayer(d,'shape-1','layer-2')})
  assert.equal(state.present.shapes[0].layerId,'layer-2')
  state=reducer(state,{type:'edit',update:d=>removeLayer(d,'layer-2')})
  assert.equal(state.present.shapes.length,0)
  state=reducer(state,{type:'undo'});assert.equal(state.present.shapes[0].layerId,'layer-2')
  state=reducer(state,{type:'undo'});assert.deepEqual(state.present,doc)
  assert.equal(removeLayer(initialDocument,'layer-1').layers.length,1)
  assert.equal(moveToLayer(updateLayer(doc,'layer-1',l=>({...l,locked:true})),'shape-1','layer-2').shapes[0].layerId,'layer-1')
})
test('legacy v2 objects migrate into one real layer without changing rendered transforms',()=>{
  for(const repeat of ['grid','brick','hex','radial']){
    const old={version:2,shapes:[{...initialShape,id:'a'},{...initialShape,id:'b',visible:false,fill:'#112233'}],repeat,spacingX:180,spacingY:160,angle:33,mirror:true,sectors:12,background:'#ffffff'}
    const doc=migrateDocument(old)
    assert.ok(validDocument(doc));assert.equal(doc.version,3);assert.equal(doc.layers.length,1)
    assert.deepEqual(doc.shapes.map(s=>s.id),['a','b']);assert.equal(doc.shapes[1].visible,false)
    for(const [col,row] of [[0,0],[1,0],[1,1]]){
      const alternate=repeat==='radial'?col%2===1:Math.abs((col+row)%2)===1
      const x=repeat==='radial'?0:col*180+(repeat!=='grid'&&Math.abs(row%2)===1?90:0)
      const y=repeat==='radial'?0:row*(repeat==='hex'?180*Math.sqrt(3)/2:160)
      const angle=repeat==='radial'?33+(col+(alternate?1:0))*360/12:33
      const expected=rotation(angle,x,y,alternate),actual=tileInstance(doc,col,row).matrix
      actual.forEach((v,i)=>near(v,expected[i]))
    }
  }
})
test('document validation rejects orphan objects and duplicate layers',()=>{
  assert.ok(!validDocument({...initialDocument,shapes:[{...initialShape,layerId:'missing'}]}))
  assert.ok(!validDocument({...initialDocument,layers:[initialLayer,initialLayer]}))
  assert.ok(!validDocument({...initialDocument,layers:[]}))
  assert.ok(!validDocument({...initialDocument,rotationStep:NaN}))
})
test('primitive menu supports rectangles, ovals, and exactly 3 through 100 polygon sides',()=>{
  assert.equal(primitivePoints('rectangle',120,60).points.length,4)
  assert.equal(primitivePoints('rectangle',120,60,101).points.length,4)
  assert.equal(primitivePoints('ellipse',120,60,NaN).points.length,32)
  const ellipse={...initialShape,...primitivePoints('ellipse',120,60)}
  near(objectBounds(ellipse).width,120);near(objectBounds(ellipse).height,60)
  for(const n of [3,4,6,99,100])assert.equal(primitivePoints('polygon',100,100,n).points.length,n)
  for(const n of [2,101,3.5,NaN])assert.throws(()=>primitivePoints('polygon',100,100,n))
})
test('arrow resize keeps opposite anchor; Shift locks proportions; Alt scales from center',()=>{
  const free=resizeObject(rectangle,{x:1,y:1},{x:150,y:25},false)
  assert.deepEqual(objectBounds(free),{x:-50,y:-25,width:200,height:50})
  const locked=resizeObject(rectangle,{x:1,y:1},{x:150,y:25},true)
  const b=objectBounds(locked);near(b.width/b.height,2);near(b.x,-50);near(b.y,-25)
  const centered=resizeObject(rectangle,{x:1,y:1},{x:100,y:50},true,true)
  assert.deepEqual(objectBounds(centered),{x:-100,y:-50,width:200,height:100})
  const edge=resizeObject(rectangle,{x:1,y:.5},{x:150,y:0},true)
  near(objectBounds(edge).width/objectBounds(edge).height,2)
})
test('resize gestures undo as a single operation and preserve other objects',()=>{
  const doc=addShape({...initialDocument,shapes:[rectangle]},{...initialShape,id:'second'})
  let state=history(doc);state=reducer(state,{type:'begin'})
  for(let x=55;x<100;x++)state=reducer(state,{type:'live',update:d=>({...d,shapes:d.shapes.map(s=>s.id===rectangle.id?resizeObject(rectangle,{x:1,y:1},{x,y:80},true):s)})})
  state=reducer(state,{type:'end'});assert.equal(state.past.length,1)
  assert.deepEqual(state.present.shapes[1],doc.shapes[1]);state=reducer(state,{type:'undo'});assert.deepEqual(state.present,doc)
  const huge=scaleObject(rectangle,{x:0,y:0},100,100,true),b=objectBounds(huge)
  assert.ok(b.width<=4000&&b.height<=4000);near(b.width/b.height,2)
})
test('pen edge insertion targets the evaluated contour including curves',()=>{
  const nearEdge=closestSegment(rectangle,{x:0,y:-25})
  assert.equal(nearEdge.index,0);near(nearEdge.distance,0)
  assert.ok(closestSegment(rectangle,{x:0,y:0}).distance>8)
  const ellipse={...initialShape,...primitivePoints('ellipse',100,100)}
  assert.ok(closestSegment(ellipse,{x:0,y:-50}).distance<.01)
})
test('tile transforms reflect then rotate then offset before per-column rotation',()=>{
  const doc={...initialDocument,repeat:'grid',angle:90,flipX:true,offsetX:3,offsetY:4,rotationStep:90}
  const p={x:10,y:5},source=transformPoint(p,tileInstance(doc,0,0).matrix)
  near(source.x,-2);near(source.y,-6)
  const next=transformPoint(p,tileInstance(doc,1,0).matrix)
  near(next.x,doc.spacingX+6);near(next.y,-2)
  assert.deepEqual(tileInstance(doc,1,0).cellMatrix,[1,0,0,1,doc.spacingX,0])
})
test('rotation cycles support rows, diagonals, checkerboards, and negative columns',()=>{
  const p={x:10,y:0},base={...initialDocument,repeat:'grid',rotationStep:90}
  const row=transformPoint(p,tileInstance({...base,stepAxis:'row'},0,1).matrix);near(row.x,0);near(row.y,base.spacingY+10)
  const diagonal=transformPoint(p,tileInstance({...base,stepAxis:'diagonal'},1,1).matrix);near(diagonal.x,base.spacingX-10);near(diagonal.y,base.spacingY)
  const negative=transformPoint(p,tileInstance({...base,stepAxis:'column'},-1,0).matrix);near(negative.x,-base.spacingX);near(negative.y,-10)
  const checker=transformPoint(p,tileInstance({...base,stepAxis:'checker'},-1,0).matrix);near(checker.y,10)
})
test('pattern rotation and translation move guides and artwork together and preserve culling',()=>{
  const doc={...initialDocument,repeat:'grid',latticeAngle:90,patternX:10,patternY:20}
  const cell=tileInstance(doc,1,0)
  const p=transformPoint({x:10,y:0},cell.matrix);near(p.x,10);near(p.y,215)
  const center=transformPoint({x:0,y:0},cell.cellMatrix);near(center.x,10);near(center.y,205)
  const copies=instances(doc,{x:0,y:190,width:30,height:30})
  assert.ok(copies.some(c=>c.id==='0:1'))
  const local=inversePoint(p,cell.matrix);near(local.x,10);near(local.y,0)
})
test('SVG and preview evaluate identical composed repeat transforms',()=>{
  const doc={...initialDocument,repeat:'hex',rotationStep:60,flipY:true,offsetX:15,offsetY:8,latticeAngle:23,patternX:19,patternY:-5}
  const bounds={x:-400,y:-300,width:800,height:600},svg=exportSVG(doc,800,600)
  for(const copy of instances(doc,bounds,100000))assert.ok(svg.includes(`transform="${matrixText(copy.matrix)}"`))
})
