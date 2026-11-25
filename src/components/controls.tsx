import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    circle: 'M22 12a10 10 0 11-20 0 10 10 0 0120 0', lock: 'M5 10h14v11H5zM8 10V6a4 4 0 018 0v4', unlock: 'M5 10h14v11H5zM8 10V6a4 4 0 018 0', rotate: 'M20 8a9 9 0 10-2 11M20 2v6h-6', flipX: 'M12 2v20M3 6l6 6-6 6zM21 6l-6 6 6 6z', flipY: 'M2 12h20M6 3l6 6 6-6zM6 21l6-6 6 6z',
    select: 'M5 3l14 9-7 1-3 7z', nodes: 'M4 4h16v16H4zM2 2h4v4H2zM18 2h4v4h-4zM18 18h4v4h-4zM2 18h4v4H2z',
    pen: 'M4 20l3-8L17 2l5 5-10 10zM7 12l5 5M4 20l6-2', hand: 'M8 12V5a2 2 0 014 0v6-8a2 2 0 014 0v8-6a2 2 0 014 0v11c0 4-3 6-7 6-3 0-5-1-7-4L3 13a2 2 0 013-2l2 3',
    undo: 'M9 4L4 9l5 5M4 9h10a6 6 0 010 12', redo: 'M15 4l5 5-5 5m5-5H10a6 6 0 000 12',
    split: 'M3 4h18v16H3zM12 4v16', download: 'M12 3v12m-5-5l5 5 5-5M4 16v5h16v-5', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
    grid: 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18', close: 'M5 5l14 14M19 5L5 19', fit: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    layers: 'M12 3L2 8l10 5 10-5zM2 12l10 5 10-5M2 16l10 5 10-5', shapes: 'M3 3h8v8H3zM17 3l5 8H12zM10 18a5 5 0 11-10 0 5 5 0 0110 0',
    chevron: 'M9 5l7 7-7 7', left: 'M3 4h18v16H3zM9 4v16M15 9l-3 3 3 3', right: 'M3 4h18v16H3zM15 4v16M9 9l3 3-3 3',
    palette: 'M12 3a9 9 0 100 18h2a2 2 0 000-4h-1a2 2 0 010-4h4a4 4 0 004-4 9 9 0 00-9-6zM6 9h.01M9 6h.01M14 6h.01M17 9h.01',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM15 12a3 3 0 11-6 0 3 3 0 016 0',
    hidden: 'M3 3l18 18M10 5h2c6 0 10 7 10 7a20 20 0 01-4 4M6 6a20 20 0 00-4 6s4 7 10 7c2 0 4-1 5-2',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7', copy: 'M9 8h12v13H9zM15 8V3H3v13h6', up: 'M5 15l7-7 7 7', down: 'M5 9l7 7 7-7',
    hex: 'M12 2l9 5v10l-9 5-9-5V7z', radial: 'M12 2v20M2 12h20M5 5l14 14M5 19L19 5', square: 'M4 4h16v16H4z', brick: 'M2 6h16l4 12H6z',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.select} /></svg>
}
export function Panel({ title, icon, open, onOpenChange, children, id }: { title: string; icon: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; id: string }) {
  return <Collapsible asChild open={open} onOpenChange={onOpenChange}><section className="inspector-section" data-panel-id={id}><CollapsibleTrigger className="section-trigger" aria-label={`${title} panel`}><Icon name={icon} size={15} /><span>{title}</span><span className="panel-chevron"><Icon name="chevron" size={13} /></span></CollapsibleTrigger><CollapsibleContent className="section-content">{children}</CollapsibleContent></section></Collapsible>
}
export function Range({ label, value, min, max, step = 1, unit = '', onChange, begin, end, disabled }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void; begin: () => void; end: () => void; disabled?: boolean }) {
  const [text,setText]=useState<string|null>(null),cancel=useRef(false)
  const commit=()=>{if(cancel.current){cancel.current=false;setText(null);return}const draft=text??String(value),n=Number(draft);if(draft.trim()&&Number.isFinite(n)){const next=Math.max(min,Math.min(max,label==='Sectors'?Math.round(n):n));onChange(next);setText(null)}else setText(null)}
  return <div className="range-label"><div className="range-heading"><span>{label}</span><div><input className="range-number" aria-label={`${label} value`} type="number" min={min} max={max} step={label==='Sectors'?1:'any'} value={text??String(value)} disabled={disabled} onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel.current=true;e.currentTarget.blur()}}}/><span>{unit}</span>{min<=0&&max>=0&&<button className="range-zero" type="button" aria-label={`Reset ${label} to zero`} title="Reset to zero" disabled={disabled||value===0} onClick={()=>{onChange(0);setText(null)}}>↺</button>}</div></div><input type="range" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onKeyDown={begin} onKeyUp={end} onBlur={end} onChange={e=>{setText(null);onChange(Number(e.target.value))}}/></div>
}
