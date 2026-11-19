import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './controls'

/** Hover to peek; click to keep controls open for editing. */
export function RailMenu({title,icon,side,children}:{title:string;icon:string;side:'left'|'right';children:ReactNode}) {
  const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null)
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const [open,setOpen]=useState(false),[pinned,setPinned]=useState(false)
  const [position,setPosition]=useState({left:0,top:0})
  const id=useId()
  const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null}
  const close=()=>{clear();setOpen(false);setPinned(false)}
  function show(){clear();window.dispatchEvent(new CustomEvent('tesselate:rail-open',{detail:id}));const rect=trigger.current?.getBoundingClientRect();if(rect)setPosition({left:Math.max(8,Math.min(side==='left'?rect.right+6:rect.left-286,window.innerWidth-288)),top:Math.max(8,Math.min(rect.top,window.innerHeight-330))});setOpen(true)}
  function leave(){clear();if(!pinned)timer.current=setTimeout(()=>{if(!popup.current?.contains(document.activeElement))setOpen(false)},180)}
  useEffect(()=>{
    if(!open)return
    const outside=(event:PointerEvent)=>{if(!popup.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node)){setOpen(false);setPinned(false)}}
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);setPinned(false);trigger.current?.focus()}}
    const resize=()=>{setOpen(false);setPinned(false)}
    window.addEventListener('pointerdown',outside);window.addEventListener('keydown',key);window.addEventListener('resize',resize)
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key);window.removeEventListener('resize',resize)}
  },[open])
  useEffect(()=>{const other=(event:Event)=>{if((event as CustomEvent).detail!==id){setOpen(false);setPinned(false)}};window.addEventListener('tesselate:rail-open',other);return()=>{window.removeEventListener('tesselate:rail-open',other);if(timer.current)clearTimeout(timer.current)}},[id])
  return <><button ref={trigger} className={`icon-button rail-menu-trigger ${open?'selected':''}`} aria-label={`Open ${title}`} aria-expanded={open} aria-controls={open?id:undefined} aria-haspopup="dialog" onPointerEnter={event=>{if(event.pointerType==='mouse')show()}} onPointerLeave={leave} onClick={()=>{if(open&&pinned)close();else{show();setPinned(true)}}} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'||event.key==='ArrowDown'){event.preventDefault();show();setPinned(true);requestAnimationFrame(()=>popup.current?.querySelector<HTMLElement>('button,input,select')?.focus())}}}><Icon name={icon} size={18}/></button>{open&&createPortal(<div ref={popup} id={id} role="dialog" aria-label={title} className="rail-flyout" style={position} onClick={event=>{if((event.target as HTMLElement).closest('button[data-close-rail]'))close()}} onPointerEnter={clear} onPointerLeave={leave} onFocusCapture={()=>{clear();setPinned(true)}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&!pinned)leave()}}><div className="rail-flyout-header"><strong>{title}</strong><button className="icon-button" aria-label={`Close ${title}`} onClick={close}><Icon name="close" size={14}/></button></div><div className="rail-flyout-content">{children}</div></div>,document.body)}</>
}
