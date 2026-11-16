import { useEffect, useRef } from 'react'
import type { Primitive } from '../core/objects'
import { Icon } from './controls'
export function ShapeMenu({open,setOpen,disabled,selected,onSelect}:{open:boolean;setOpen:(open:boolean)=>void;disabled:boolean;selected:Primitive|null;onSelect:(kind:Primitive)=>void}){
  const ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false)};window.addEventListener('pointerdown',close);return()=>window.removeEventListener('pointerdown',close)},[open,setOpen])
  return <div className="shape-menu" ref={ref} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false)}}}><button className={`shape-menu-trigger ${selected?'selected':''}`} aria-label="Shape" aria-expanded={open} onClick={()=>setOpen(!open)}><Icon name={selected==='rectangle'?'square':selected==='ellipse'?'circle':selected==='polygon'?'hex':'shapes'} size={16}/><span>{selected==='rectangle'?'Rectangle':selected==='ellipse'?'Ellipse':selected==='polygon'?'Polygon':'Shape'}</span><Icon name="down" size={12}/></button>{open&&<div className="shape-menu-content" role="group" aria-label="Shape selection">{([['rectangle','square','Rectangle / square'],['ellipse','circle','Ellipse / circle'],['polygon','hex','Polygon']] as [Primitive,string,string][]).map(([kind,icon,label])=><button key={kind} disabled={disabled} aria-pressed={selected===kind} onClick={()=>{onSelect(kind);setOpen(false)}}><Icon name={icon} size={16}/>{label}</button>)}</div>}</div>
}
