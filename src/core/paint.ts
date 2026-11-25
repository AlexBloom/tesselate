import type { PatternDocument, Shape } from './geometry'
export type Gradient = { type:'linear'|'radial'; angle:number; stops:{color:string;offset:number}[] }
export const isHex=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)
export function validGradient(value:unknown):value is Gradient {
  if(!value||typeof value!=='object')return false
  const g=value as Gradient
  return ['linear','radial'].includes(g.type)&&Number.isFinite(g.angle)&&g.angle>=-180&&g.angle<=360&&Array.isArray(g.stops)&&g.stops.length>=2&&g.stops.length<=8&&g.stops.every((s,i)=>s&&isHex(s.color)&&Number.isFinite(s.offset)&&s.offset>=0&&s.offset<=1&&(i===0||s.offset>=g.stops[i-1].offset))
}
export function gradientEndpoints(angle:number){const a=angle*Math.PI/180;return {x1:.5-Math.cos(a)/2,y1:.5-Math.sin(a)/2,x2:.5+Math.cos(a)/2,y2:.5+Math.sin(a)/2}}
export function gradientSVG(id:string,g:Gradient){
  const stops=g.stops.map(s=>`<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('')
  if(g.type==='radial')return `<radialGradient id="${id}">${stops}</radialGradient>`
  const p=gradientEndpoints(g.angle)
  return `<linearGradient id="${id}" x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}">${stops}</linearGradient>`
}
export function paintCSS(color:string,g?:Gradient){return !g?color:g.type==='radial'?`radial-gradient(circle,${g.stops.map(s=>`${s.color} ${s.offset*100}%`).join(',')})`:`linear-gradient(${g.angle+90}deg,${g.stops.map(s=>`${s.color} ${s.offset*100}%`).join(',')})`}

export function shapePaint(doc:PatternDocument,s:Shape,prefix:string,key:'fill'|'stroke'){return s[key==='fill'?'fillGradient':'strokeGradient']?`url(#${prefix}-${key}-${doc.shapes.findIndex(o=>o.id===s.id)})`:s[key]}
