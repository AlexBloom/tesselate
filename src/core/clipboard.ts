import { initialDocument, translateShape, validDocument } from './geometry.ts'
import type { PatternDocument, Shape, Layer, Point } from './geometry.ts'
import type { StackTarget } from './stacking.ts'
export type ClipboardData={format:'tesselate';version:1;kind:'layer'|'object';layers:Layer[];shapes:Shape[]}
export function copyTarget(doc:PatternDocument,target:StackTarget):ClipboardData|null {
  const shape=doc.shapes.find(s=>s.id===target.id),layer=doc.layers.find(l=>l.id===(target.kind==='layer'?target.id:shape?.layerId))
  if(!layer||(target.kind==='object'&&!shape))return null
  return structuredClone({format:'tesselate',version:1,kind:target.kind,layers:[layer],shapes:target.kind==='layer'?doc.shapes.filter(s=>s.layerId===layer.id):[shape!]})
}
export function readClipboard(text:string):ClipboardData|null {
  if(text.length>2000000)return null
  try{const data=JSON.parse(text);if(data.format!=='tesselate'||data.version!==1||!['layer','object'].includes(data.kind)||data.layers?.length!==1||(data.kind==='object'&&data.shapes?.length!==1))return null;return validDocument({...initialDocument,layers:data.layers,shapes:data.shapes})?data:null}catch{return null}
}
export function pasteTarget(doc:PatternDocument,data:ClipboardData,layerId:string,id:()=>string,delta:Point={x:20,y:20}):{doc:PatternDocument;target:StackTarget}|null {
  if(!readClipboard(JSON.stringify(data))||doc.shapes.length+data.shapes.length>64)return null
  if(data.kind==='layer'&&doc.layers.length>=32)return null
  const layer=doc.layers.find(l=>l.id===layerId)
  if(data.kind==='object'&&(!layer||layer.locked||!layer.visible))return null
  data=structuredClone(data)
  const newLayer=data.kind==='layer'?{...data.layers[0],id:id(),name:`${data.layers[0].name} copy`.slice(0,80),locked:false}:null
  const shapes=data.shapes.map(s=>translateShape({...s,id:id(),layerId:newLayer?.id??layerId,name:`${s.name} copy`.slice(0,80)},delta))
  // Preserve the relative positions of an entire copied layer near coordinate limits.
  if(shapes.length&&data.kind==='layer'){
    const all={...data.shapes[0],points:data.shapes.flatMap(s=>s.points)},moved=translateShape(all,delta),dx=moved.points[0].x-all.points[0].x,dy=moved.points[0].y-all.points[0].y
    shapes.forEach((s,i)=>{s.points=data.shapes[i].points.map(p=>({x:p.x+dx,y:p.y+dy}))})
  }
  return {doc:{...doc,layers:newLayer?[...doc.layers,newLayer]:doc.layers,shapes:[...doc.shapes,...shapes]},target:newLayer?{kind:'layer',id:newLayer.id}:{kind:'object',id:shapes[0].id}}
}
