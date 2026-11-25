import svgpath from 'svgpath'
import type { Point } from './geometry.ts'
import type { Edge } from './network.ts'
/** Normalize SVG commands to editable absolute line/cubic edges. Arcs become cubics. */
export function parsePath(data:string,transforms:string[]=[]):{points:Point[];edges:Edge[]}{
  if(data.length>500000)throw new Error('SVG path is too large.')
  const path=svgpath(data).abs().unshort().unarc()
  for(const transform of [...transforms].reverse())if(transform)path.transform(transform)
  if((path as unknown as {err:string}).err)throw new Error('Invalid SVG path data.')
  const points:Point[]=[],edges:Edge[]=[];let current=-1,start=-1
  const add=(p:Point)=>{if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e9||Math.abs(p.y)>1e9)throw new Error('Invalid SVG coordinate.');if(points.length>=300)throw new Error('A path can contain up to 300 anchors.');points.push(p);return points.length-1}
  path.iterate(s=>{const command=s[0].toUpperCase(),n=s.slice(1) as number[]
    if(command==='M'){current=add({x:n[0],y:n[1]});start=current;return}
    if(current<0)throw new Error('SVG path needs a starting point.')
    if(command==='Z'){
      if(current!==start){const a=points[current],b=points[start];if(a.x===b.x&&a.y===b.y){const last=current;for(const edge of edges){if(edge.to===last)edge.to=start;if(edge.from===last)edge.from=start}if(last===points.length-1)points.pop()}else edges.push({from:current,to:start})}current=start;return
    }
    const a=points[current];let b:Point,c1:Point|undefined,c2:Point|undefined
    if(command==='L')b={x:n[0],y:n[1]};else if(command==='H')b={x:n[0],y:a.y};else if(command==='V')b={x:a.x,y:n[0]};else if(command==='C'){c1={x:n[0],y:n[1]};c2={x:n[2],y:n[3]};b={x:n[4],y:n[5]}}else if(command==='Q'){const q={x:n[0],y:n[1]};b={x:n[2],y:n[3]};c1={x:a.x+(q.x-a.x)*2/3,y:a.y+(q.y-a.y)*2/3};c2={x:b.x+(q.x-b.x)*2/3,y:b.y+(q.y-b.y)*2/3}}else throw new Error(`Unsupported SVG path command ${command}.`)
    const to=add(b);edges.push({from:current,to,c1,c2});current=to
  })
  if(!points.length)throw new Error('SVG path is empty.')
  return {points,edges:edges.filter(e=>e.from!==e.to||Boolean(e.c1&&e.c2))}
}
