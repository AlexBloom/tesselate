import type { PatternDocument, Shape } from './geometry'
export type Gradient = { units?:'objectBoundingBox'|'userSpaceOnUse'; type:'linear'|'radial'; angle:number; geometry?:{x1?:number;y1?:number;x2?:number;y2?:number;cx?:number;cy?:number;r?:number;fx?:number;fy?:number}; transform?:[number,number,number,number,number,number]; stops:{color:string;offset:number;opacity?:number}[] }
export const isHex=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)
export function validGradient(value:unknown):value is Gradient {
  if(!value||typeof value!=='object')return false
  const g=value as Gradient
  return (g.units===undefined||['objectBoundingBox','userSpaceOnUse'].includes(g.units))&&(g.geometry===undefined||(g.geometry!==null&&typeof g.geometry==='object'&&Object.entries(g.geometry).every(([k,n])=>['x1','y1','x2','y2','cx','cy','r','fx','fy'].includes(k)&&typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e6)))&&(g.transform===undefined||(Array.isArray(g.transform)&&g.transform.length===6&&g.transform.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6)))&&['linear','radial'].includes(g.type)&&Number.isFinite(g.angle)&&g.angle>=-180&&g.angle<=360&&Array.isArray(g.stops)&&g.stops.length>=2&&g.stops.length<=8&&g.stops.every((s,i)=>s&&isHex(s.color)&&(s.opacity===undefined||(Number.isFinite(s.opacity)&&s.opacity>=0&&s.opacity<=1))&&Number.isFinite(s.offset)&&s.offset>=0&&s.offset<=1&&(i===0||s.offset>=g.stops[i-1].offset))
}
export function gradientEndpoints(angle:number){const a=angle*Math.PI/180;return {x1:.5-Math.cos(a)/2,y1:.5-Math.sin(a)/2,x2:.5+Math.cos(a)/2,y2:.5+Math.sin(a)/2}}
export function gradientSVG(id:string,g:Gradient){
  const stops=g.stops.map(s=>`<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity??1}"/>`).join('')
  const extra=(g.units?` gradientUnits="${g.units}"`:'')+(g.transform?` gradientTransform="matrix(${g.transform.join(' ')})"`:'')+Object.entries(g.geometry??{}).map(([key,n])=>` ${key}="${n}"`).join('')
  if(g.type==='radial')return `<radialGradient id="${id}"${extra}>${stops}</radialGradient>`
  const p=g.geometry?{}:gradientEndpoints(g.angle)
  return `<linearGradient id="${id}"${extra}${Object.entries(p).map(([k,n])=>` ${k}="${n}"`).join('')}>${stops}</linearGradient>`
}
export function paintCSS(color:string,g?:Gradient){return !g?(color==='none'?'transparent':color):g.type==='radial'?`radial-gradient(circle,${g.stops.map(s=>`${s.color} ${s.offset*100}%`).join(',')})`:`linear-gradient(${g.angle+90}deg,${g.stops.map(s=>`${s.color} ${s.offset*100}%`).join(',')})`}

export function shapePaint(doc:PatternDocument,s:Shape,prefix:string,key:'fill'|'stroke'){return s[key==='fill'?'fillGradient':'strokeGradient']?`url(#${prefix}-${key}-${doc.shapes.findIndex(o=>o.id===s.id)})`:s[key]}
