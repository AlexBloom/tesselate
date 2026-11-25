import { pathData, multiply } from './geometry.ts'
import type { Point, Shape } from './geometry.ts'
export type Edge={from:number;to:number;c1?:Point;c2?:Point}
const point=(p:Point)=>({x:p.x,y:p.y})
const mix=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})
export function graph(shape:Shape):Shape&{edges:Edge[]}{
  if(shape.edges)return shape as Shape&{edges:Edge[]}
  const p=shape.points,n=p.length
  return {...shape,smooth:0,edges:p.map((a,i)=>{const b=p[(i+1)%n],prev=p[(i+n-1)%n],after=p[(i+2)%n];return {from:i,to:(i+1)%n,...(shape.smooth?{c1:{x:a.x+(b.x-prev.x)*shape.smooth/6,y:a.y+(b.y-prev.y)*shape.smooth/6},c2:{x:b.x-(after.x-a.x)*shape.smooth/6,y:b.y-(after.y-a.y)*shape.smooth/6}}:{})}})}
}
export function shapePath(shape:Shape):string{
  if(!shape.edges)return pathData(shape.points,shape.smooth)
  const g=graph(shape);let text='',last=-1,start=-1
  for(const e of g.edges){const a=g.points[e.from],b=g.points[e.to];if(last!==e.from){text+=`M ${a.x} ${a.y} `;start=e.from}text+=e.c1&&e.c2?`C ${e.c1.x} ${e.c1.y} ${e.c2.x} ${e.c2.y} ${b.x} ${b.y} `:`L ${b.x} ${b.y} `;last=e.to;if(last===start){text+='Z ';last=-1}}
  return text.trim()||`M ${g.points[0]?.x??0} ${g.points[0]?.y??0}`
}
export function geometryPoints(shape:Shape):Point[]{return [...shape.points,...(shape.edges??[]).flatMap(e=>[e.c1,e.c2].filter((p):p is Point=>Boolean(p)))]}
export function mapGeometry(shape:Shape,fn:(p:Point)=>Point,vector:(p:Point)=>Point=(p)=>p):Shape{
 const a=fn({x:0,y:0}),b=fn({x:1,y:0}),c=fn({x:0,y:1}),matrix:[number,number,number,number,number,number]=[b.x-a.x,b.y-a.y,c.x-a.x,c.y-a.y,a.x,a.y]
 const paint=(g:Shape['fillGradient'])=>g?.units==='userSpaceOnUse'?{...g,transform:multiply(matrix,g.transform??[1,0,0,1,0,0])}:g
 return {...shape,fillGradient:paint(shape.fillGradient),strokeGradient:paint(shape.strokeGradient),points:shape.points.map(fn),...(shape.edges?{edges:shape.edges.map(e=>({...e,c1:e.c1&&fn(e.c1),c2:e.c2&&fn(e.c2)}))}:{}),...(shape.tangents?{tangents:shape.tangents.map(vector)}:{})}
}
export function moveNode(shape:Shape,index:number,target:Point):Shape{
  const old=shape.points[index];if(!old)return shape;const attached=[old,...(shape.edges??[]).flatMap(e=>[e.from===index?e.c1:undefined,e.to===index?e.c2:undefined].filter((p):p is Point=>Boolean(p)))];const dx=Math.max(-2000-Math.min(...attached.map(p=>p.x)),Math.min(2000-Math.max(...attached.map(p=>p.x)),target.x-old.x)),dy=Math.max(-2000-Math.min(...attached.map(p=>p.y)),Math.min(2000-Math.max(...attached.map(p=>p.y)),target.y-old.y));target={x:old.x+dx,y:old.y+dy}
  return {...shape,points:shape.points.map((p,i)=>i===index?point(target):p),...(shape.edges?{edges:shape.edges.map(e=>({...e,c1:e.c1&&e.from===index?{x:e.c1.x+dx,y:e.c1.y+dy}:e.c1,c2:e.c2&&e.to===index?{x:e.c2.x+dx,y:e.c2.y+dy}:e.c2}))}:{})}
}
export function edgePoint(shape:Shape,edge:Edge,t:number){const a=shape.points[edge.from],b=shape.points[edge.to];if(!edge.c1||!edge.c2)return mix(a,b,t);const c=mix(a,edge.c1,t),d=mix(edge.c1,edge.c2,t),e=mix(edge.c2,b,t);return mix(mix(c,d,t),mix(d,e,t),t)}
export function nearestEdge(shape:Shape,p:Point){const g=graph(shape);let best={index:-1,distance:Infinity,t:.5,point:p};g.edges.forEach((edge,index)=>{let last=g.points[edge.from];for(let j=1;j<=40;j++){const next=edgePoint(g,edge,j/40),dx=next.x-last.x,dy=next.y-last.y,f=Math.max(0,Math.min(1,((p.x-last.x)*dx+(p.y-last.y)*dy)/(dx*dx+dy*dy||1))),q={x:last.x+f*dx,y:last.y+f*dy},distance=Math.hypot(p.x-q.x,p.y-q.y);if(distance<best.distance)best={index,distance,t:(j-1+f)/40,point:q};last=next}});return best}
export function splitEdge(shape:Shape,index:number,t=.5):{shape:Shape;node:number}{
  const g=graph(shape),e=g.edges[index];if(!e||g.points.length>=300)return {shape,node:-1};t=Math.max(.001,Math.min(.999,t))
  const a=g.points[e.from],b=g.points[e.to],node=g.points.length,p=edgePoint(g,e,t)
  let first:Edge={from:e.from,to:node},second:Edge={from:node,to:e.to}
  if(e.c1&&e.c2){const c=mix(a,e.c1,t),d=mix(e.c1,e.c2,t),f=mix(e.c2,b,t),h=mix(c,d,t),i=mix(d,f,t);first={...first,c1:c,c2:h};second={...second,c1:i,c2:f}}
  const edges=[...g.edges];edges.splice(index,1,first,second)
  return {shape:{...g,points:[...g.points,p],edges,tangents:g.tangents?[...g.points.map((_,i)=>g.tangents?.[i]??{x:0,y:0}),{x:0,y:0}]:undefined},node}
}
export function edgeMode(shape:Shape,index:number,curved:boolean):Shape{const g=graph(shape);return {...g,edges:g.edges.map((e,i)=>i!==index?e:curved?{...e,c1:e.c1??mix(g.points[e.from],g.points[e.to],1/3),c2:e.c2??mix(g.points[e.from],g.points[e.to],2/3)}:{from:e.from,to:e.to})}}
export function tangentNode(shape:Shape,index:number,vector:Point):Shape{const g=graph(shape),p=g.points[index];if(!p)return shape;vector={x:Math.max(-2000+Math.abs(p.x),Math.min(2000-Math.abs(p.x),vector.x)),y:Math.max(-2000+Math.abs(p.y),Math.min(2000-Math.abs(p.y),vector.y))};return {...g,tangents:g.points.map((_,i)=>i===index?vector:g.tangents?.[i]??{x:0,y:0}),edges:g.edges.map(e=>{let next=e;if(e.from===index)next={...next,c1:{x:p.x+vector.x,y:p.y+vector.y},c2:next.c2??mix(p,g.points[e.to],2/3)};if(e.to===index)next={...next,c1:next.c1??mix(g.points[e.from],p,1/3),c2:{x:p.x-vector.x,y:p.y-vector.y}};return next})}}
export function nodeMode(shape:Shape,index:number,curved:boolean):Shape{let g=graph(shape);if(!curved)return {...g,tangents:g.tangents?.map((p,i)=>i===index?{x:0,y:0}:p),edges:g.edges.map(e=>{if(e.from!==index&&e.to!==index)return e;if(!e.c1||!e.c2)return e;const c1=e.from===index?g.points[index]:e.c1,c2=e.to===index?g.points[index]:e.c2,a=g.points[e.from],b=g.points[e.to];return c1.x===a.x&&c1.y===a.y&&c2.x===b.x&&c2.y===b.y&&e.from!==e.to?{from:e.from,to:e.to}:{...e,c1,c2}})};const incoming=g.edges.find(e=>e.to===index),outgoing=g.edges.find(e=>e.from===index),a=g.points[incoming?.from??index],b=g.points[outgoing?.to??index];g=tangentNode(g,index,{x:(b.x-a.x)/6,y:(b.y-a.y)/6}) as typeof g;return g}
export function removeNode(shape:Shape,index:number):Shape{const g=graph(shape);if(g.points.length<=1)return shape;return {...g,points:g.points.filter((_,i)=>i!==index),tangents:g.tangents?.filter((_,i)=>i!==index),edges:g.edges.filter(e=>e.from!==index&&e.to!==index).map(e=>({...e,from:e.from>index?e.from-1:e.from,to:e.to>index?e.to-1:e.to}))}}
export function connect(shape:Shape,from:number,to:number):Shape{const g=graph(shape);if(from===to||!g.points[from]||!g.points[to]||g.edges.some(e=>(e.from===from&&e.to===to)||(e.from===to&&e.to===from))||g.edges.length>=900)return g;const v=g.tangents?.[from],w=g.tangents?.[to],a=g.points[from],b=g.points[to];return {...g,edges:[...g.edges,{from,to,...((v&&(v.x||v.y))||(w&&(w.x||w.y))?{c1:v?{x:a.x+v.x,y:a.y+v.y}:mix(a,b,1/3),c2:w?{x:b.x-w.x,y:b.y-w.y}:mix(a,b,2/3)}:{})}]}}
/** Exact cubic extrema for SVG objectBoundingBox paints (handles are not the bounds). */
export function pathBounds(shape:Shape){const g=graph(shape),points=[...g.points];for(const e of g.edges){if(!e.c1||!e.c2)continue;for(const axis of ['x','y'] as const){const p=g.points[e.from][axis],q=e.c1[axis],r=e.c2[axis],s=g.points[e.to][axis],a=-p+3*q-3*r+s,b=2*(p-2*q+r),c=q-p;const roots=Math.abs(a)<1e-12?(Math.abs(b)<1e-12?[]:[-c/b]):b*b-4*a*c<0?[]:[(-b+Math.sqrt(b*b-4*a*c))/(2*a),(-b-Math.sqrt(b*b-4*a*c))/(2*a)];for(const t of roots)if(t>0&&t<1)points.push(edgePoint(g,e,t))}}const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return {x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y}}
/** Joining networks uses the starting object's paint and keeps absolute geometry. */
export function joinNetworks(a:Shape,from:number,b:Shape,to:number):{shape:Shape;node:number}|null{const left=graph(a),right=graph(b),offset=left.points.length;if(a.id===b.id||a.layerId!==b.layerId||offset+right.points.length>300||left.edges.length+right.edges.length>=900||!left.points[from]||!right.points[to])return null;const shape=connect({...left,points:[...left.points,...right.points],edges:[...left.edges,...right.edges.map(e=>({...e,from:e.from+offset,to:e.to+offset}))],tangents:[...left.points.map((_,i)=>left.tangents?.[i]??{x:0,y:0}),...right.points.map((_,i)=>right.tangents?.[i]??{x:0,y:0})]},from,offset+to);return {shape,node:offset+to}}
