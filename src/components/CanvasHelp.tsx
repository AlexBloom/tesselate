import { useId, useState } from 'react'
export function CanvasHelp({shortcut,text}:{shortcut:string;text:string}) {
  const id=useId(),[open,setOpen]=useState(false)
  return <div className="canvas-tool-help" onPointerEnter={()=>setOpen(true)} onPointerLeave={()=>setOpen(false)} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false)}}}>
    <button className="help-key" type="button" aria-label={`Tool help (${shortcut})`} aria-describedby={open?id:undefined} onClick={()=>setOpen(true)}>{shortcut}</button>
    {open&&<div id={id} role="tooltip" className="canvas-tool-tooltip">{text}</div>}
  </div>
}
