import { geometryPoints, mapGeometry } from './network.ts'
import type { Bounds, Point, Shape } from './geometry.ts'
export type Primitive = 'rectangle' | 'ellipse' | 'polygon'
export function primitivePoints(kind: Primitive, width: number, height: number, sides = 6): { points: Point[]; smooth: number } {
  if (![width,height].every(n=>Number.isFinite(n)&&n>=1&&n<=1000) || (kind==='polygon'&&(!Number.isInteger(sides)||sides<3||sides>100))) throw new Error('Use sizes 1–1000 and polygon sides 3–100.')
  if (kind === 'rectangle') return { points: [{x:-width/2,y:-height/2},{x:width/2,y:-height/2},{x:width/2,y:height/2},{x:-width/2,y:height/2}], smooth: 0 }
  const n = kind === 'ellipse' ? 32 : sides
  return { points: Array.from({length:n},(_,i)=>({x:Math.cos(i*2*Math.PI/n-Math.PI/2)*width/2,y:Math.sin(i*2*Math.PI/n-Math.PI/2)*height/2})), smooth: kind==='ellipse' ? 1 : 0 }
}
export function objectBounds(shape: Shape): Bounds {
  const x=Math.min(...geometryPoints(shape).map(p=>p.x)),y=Math.min(...geometryPoints(shape).map(p=>p.y))
  return {x,y,width:Math.max(...geometryPoints(shape).map(p=>p.x))-x,height:Math.max(...geometryPoints(shape).map(p=>p.y))-y}
}
export function scaleObject(shape: Shape, anchor: Point, sx: number, sy: number, proportional = false): Shape {
  function limits(axis:'x'|'y') {
    let min=-Infinity,max=Infinity
    for(const p of geometryPoints(shape)){const d=p[axis]-anchor[axis];if(!d)continue;const a=(-2000-anchor[axis])/d,b=(2000-anchor[axis])/d;min=Math.max(min,Math.min(a,b));max=Math.min(max,Math.max(a,b))}
    return [min,max]
  }
  const x=limits('x'),y=limits('y')
  sx=Math.max(x[0],Math.min(x[1],sx));sy=Math.max(y[0],Math.min(y[1],sy))
  if(proportional){const amount=Math.min(Math.abs(sx),Math.abs(sy));sx=Math.sign(sx)*amount;sy=Math.sign(sy)*amount}
  return mapGeometry(shape,p=>({x:anchor.x+(p.x-anchor.x)*sx,y:anchor.y+(p.y-anchor.y)*sy}),p=>({x:p.x*sx,y:p.y*sy}))
}
export function resizeObject(shape: Shape, handle: Point, target: Point, proportional: boolean, centered = false): Shape {
  const b=objectBounds(shape)
  const anchor={x:b.x+b.width*(centered ? .5 : 1-handle.x),y:b.y+b.height*(centered ? .5 : 1-handle.y)}
  const start={x:b.x+b.width*handle.x,y:b.y+b.height*handle.y}
  let sx=handle.x===.5?1:(target.x-anchor.x)/(start.x-anchor.x||1),sy=handle.y===.5?1:(target.y-anchor.y)/(start.y-anchor.y||1)
  if(proportional){const factor=handle.x===.5?Math.abs(sy):handle.y===.5?Math.abs(sx):Math.max(Math.abs(sx),Math.abs(sy));sx=(Math.sign(sx)||1)*factor;sy=(Math.sign(sy)||1)*factor}
  if(Math.abs(sx)<.01)sx=.01;if(Math.abs(sy)<.01)sy=.01
  return scaleObject(shape,anchor,sx,sy,proportional)
}
/** Find the closest segment, sampling the same automatic cubic contour used by pathData. */
export function closestSegment(shape: Shape, point: Point): { index: number; distance: number } {
  let best={index:0,distance:Infinity}
  const n=shape.points.length
  for(let i=0;i<n;i++){
    const a=shape.points[i],b=shape.points[(i+1)%n],prev=shape.points[(i+n-1)%n],after=shape.points[(i+2)%n]
    const c={x:a.x+(b.x-prev.x)*shape.smooth/6,y:a.y+(b.y-prev.y)*shape.smooth/6},d={x:b.x-(after.x-a.x)*shape.smooth/6,y:b.y-(after.y-a.y)*shape.smooth/6}
    let last=a
    for(let j=1;j<=20;j++){const t=j/20,u=1-t;const next=shape.smooth?{x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y}:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};const dx=next.x-last.x,dy=next.y-last.y;const f=Math.max(0,Math.min(1,((point.x-last.x)*dx+(point.y-last.y)*dy)/(dx*dx+dy*dy||1)));const distance=Math.hypot(point.x-last.x-f*dx,point.y-last.y-f*dy);if(distance<best.distance)best={index:i,distance};last=next}
  }
  return best
}
