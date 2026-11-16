import { useEffect, useRef } from 'react'
import { primitivePoints } from '../core/objects'
import { pathData } from '../core/geometry'
import { Icon } from './controls'
export function PolygonPlacement({screen,sides,setSides,onPlace,onCancel}:{screen:{x:number;y:number};sides:number;setSides:(n:number)=>void;onPlace:()=>void;onCancel:()=>void}){
  const ref=useRef<HTMLDivElement>(null),valid=Number.isInteger(sides)&&sides>=3&&sides<=100
  useEffect(()=>{const close=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))onCancel()};window.addEventListener('pointerdown',close,true);return()=>window.removeEventListener('pointerdown',close,true)},[onCancel])
  return <div className="polygon-placement" ref={ref} role="dialog" aria-label="Place polygon" style={{left:Math.max(12,Math.min(screen.x+12,window.innerWidth-230)),top:Math.max(12,Math.min(screen.y+12,window.innerHeight-235))}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onCancel()}if(e.key==='Enter'&&valid){e.stopPropagation();e.preventDefault();onPlace()}}}><div className="placement-heading"><span>Polygon</span><button className="icon-button" aria-label="Cancel polygon" onClick={onCancel}><Icon name="close" size={14}/></button></div><svg viewBox="-60 -60 120 120" aria-hidden="true"><path d={pathData(primitivePoints('polygon',80,80,valid?sides:6).points)}/></svg><label className="sides-field">Sides<input aria-label="Polygon sides" type="number" min={3} max={100} step={1} autoFocus value={sides} onFocus={e=>e.currentTarget.select()} onChange={e=>setSides(e.target.valueAsNumber||0)}/></label><button className="primary" disabled={!valid} onClick={onPlace}>Place polygon</button></div>
}
