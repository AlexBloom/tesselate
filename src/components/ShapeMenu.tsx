import { useEffect, useRef, useState } from 'react'
import type { Primitive } from '../core/objects'
import { Icon } from './controls'
export function ShapeMenu({open,setOpen,disabled,onAdd}:{open:boolean;setOpen:(open:boolean)=>void;disabled:boolean;onAdd:(kind:Primitive,width:number,height:number,sides:number)=>void}){
  const ref=useRef<HTMLDivElement>(null)
  const [width,setWidth]=useState(100),[height,setHeight]=useState(100),[sides,setSides]=useState(6)
  const validSize=[width,height].every(n=>Number.isFinite(n)&&n>=1&&n<=1000)
  const validSides=Number.isInteger(sides)&&sides>=3&&sides<=100
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false)};window.addEventListener('pointerdown',close);return()=>window.removeEventListener('pointerdown',close)},[open,setOpen])
  return <div className="shape-menu" ref={ref} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false)}}}>
    <button className="shape-menu-trigger" aria-label="Shape" aria-expanded={open} onClick={()=>setOpen(!open)}><Icon name="shapes" size={16}/><span>Shape</span><Icon name="down" size={12}/></button>
    {open&&<div className="shape-menu-content" role="group" aria-label="Add shape"><div className="coordinate-inputs">{(['Width','Height'] as const).map(label=><label key={label}><span>{label[0]}</span><input aria-label={`New shape ${label.toLowerCase()}`} type="number" min={1} max={1000} value={label==='Width'?width:height} onChange={e=>(label==='Width'?setWidth:setHeight)(e.target.valueAsNumber||0)}/></label>)}</div><label className="sides-field">Polygon sides<input type="number" aria-label="Polygon sides" min={3} max={100} step={1} value={sides} onChange={e=>setSides(e.target.valueAsNumber||0)}/></label>{([['rectangle','square','Rectangle / square'],['ellipse','circle','Ellipse / circle'],['polygon','hex','Polygon']] as [Primitive,string,string][]).map(([kind,icon,label])=><button key={kind} disabled={disabled||!validSize||(kind==='polygon'&&!validSides)} onClick={()=>{onAdd(kind,width,height,sides);setOpen(false)}}><Icon name={icon} size={16}/>{label}{kind==='polygon'&&<small>{sides} sides</small>}</button>)}<p className="field-note">Add to the selected layer. Shift-resize locks proportions.</p></div>}
  </div>
}
