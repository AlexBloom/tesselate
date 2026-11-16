import { useEffect, useId, useRef, useState } from 'react'
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react'
import { guideGeometry, guideMatrix, instances, inversePoint, matrixText, pathData, tileInstance, translateShape, updateShape, visibleShapes, editableShape } from '../core/geometry'
import type { PatternDocument, Point, Shape } from '../core/geometry'
import { objectBounds, resizeObject, closestSegment } from '../core/objects'
import type { Action } from '../core/history'
import { Icon } from './controls'
export type Tool = 'select' | 'nodes' | 'pen' | 'hand'
export type View = { x: number; y: number; zoom: number }
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
export function MotifPaths({ doc }: { doc: PatternDocument }) {
  return <>{visibleShapes(doc).map(shape => <path key={shape.id} data-shape-id={shape.id} d={pathData(shape.points, shape.smooth)} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} strokeLinejoin="round" />)}</>
}
type CanvasProps = {
  doc: PatternDocument; view: View; setView: (v: View | ((v: View) => View)) => void; focus: boolean; guides: boolean; tool: Tool; proportional: boolean; canDraw: boolean; activeId: string | null; selected: number | null; onSelect: (id: string | null, node?: number | null) => void; onEditNodes: () => void;
  draft: Point[]; onDraftPoint: (p: Point) => void; finishDraft: () => void; dispatch: Dispatch<Action>
}
export function Canvas({ doc, view, setView, focus, guides, tool, proportional, canDraw, activeId, selected, onSelect, onEditNodes, draft, onDraftPoint, finishDraft, dispatch }: CanvasProps) {
  const container = useRef<HTMLDivElement>(null), svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 800, height: 650 })
  const drag = useRef<{ kind: 'node'; id: string; index: number } | { kind: 'shape'; id: string; original: Shape; start: Point } | { kind: 'resize'; id: string; original: Shape; handle: Point } | { kind: 'pan'; x: number; y: number; view: View } | null>(null)
  const lastHit=useRef<{id:string;time:number;x:number;y:number}|null>(null)
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  useEffect(() => {
    const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; if (width && height) setSize({ width, height }) })
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const bounds = { x: view.x - size.width / view.zoom / 2, y: view.y - size.height / view.zoom / 2, width: size.width / view.zoom, height: size.height / view.zoom }
  const guide = guideGeometry(doc)
  let copies: ReturnType<typeof instances> = [], guideCopies: ReturnType<typeof instances> = [], warning = ''
  try {
    copies = instances(doc, bounds, Math.max(100, Math.floor(8000 / Math.max(1, visibleShapes(doc).length))))
    if (focus && guides) guideCopies = instances(doc, bounds, 4000, guide.radius)
  } catch (e) { warning = e instanceof Error ? e.message : 'Preview limit reached' }
  const active = doc.shapes.find(s => s.id === activeId && editableShape(doc, s))
  function point(event: ReactPointerEvent<SVGElement>): Point {
    const svg = svgRef.current!, matrix = svg.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY
    return inversePoint(p.matrixTransform(matrix.inverse()), tileInstance(doc,0,0).matrix)
  }
  function start(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.button !== 1) return
    if (!focus || tool === 'hand' || event.button === 1) {
      event.preventDefault(); drag.current = { kind: 'pan', x: event.clientX, y: event.clientY, view }; event.currentTarget.setPointerCapture(event.pointerId)
    } else if (tool === 'pen' && canDraw) { const p = point(event); onDraftPoint({ x: clamp(p.x, -2000, 2000), y: clamp(p.y, -2000, 2000) }) }
    else onSelect(null)
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!current) return
    if (current.kind === 'pan') setView({ ...current.view, x: current.view.x - (event.clientX - current.x) / current.view.zoom, y: current.view.y - (event.clientY - current.y) / current.view.zoom })
    else {
      if(current.kind==='shape'&&Math.hypot(event.movementX,event.movementY)>1)lastHit.current=null
      const p = point(event)
      dispatch({ type: 'live', update: d => updateShape(d, current.id, shape => current.kind === 'resize' ? resizeObject(current.original,current.handle,p,event.shiftKey||proportional,event.altKey) : current.kind === 'shape' ? translateShape(current.original, { x: p.x - current.start.x, y: p.y - current.start.y }) : { ...shape, points: shape.points.map((old, i) => i === current.index ? { x: clamp(p.x, -2000, 2000), y: clamp(p.y, -2000, 2000) } : old) }) })
    }
  }
  function stop(cancel = false) {
    if (drag.current && drag.current.kind !== 'pan') dispatch({ type: cancel ? 'cancel' : 'end' })
    drag.current = null
  }
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (drag.current && drag.current.kind !== 'pan') dispatch({ type: 'cancel' }); drag.current = null }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') drag.current = null
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [dispatch])
  function zoom(factor: number) { setView(v => ({ ...v, zoom: clamp(v.zoom * factor, 0.35, 3) })) }
  const sourceTransform = matrixText(tileInstance(doc,0,0).matrix)
  const visible = visibleShapes(doc).filter(s => s.id !== 'draft')
  const boundsOfActive = active ? objectBounds(active) : null
  const handles = [{x:0,y:0,name:'top left'},{x:.5,y:0,name:'top'},{x:1,y:0,name:'top right'},{x:1,y:.5,name:'right'},{x:1,y:1,name:'bottom right'},{x:.5,y:1,name:'bottom'},{x:0,y:1,name:'bottom left'},{x:0,y:.5,name:'left'}]

  return <div className={`canvas-pane ${focus ? 'focus-pane' : 'pattern-pane'} tool-${tool}`} ref={container}>
    <div className="pane-label"><span className="label-dot" />{focus ? (guides ? guide.label.toUpperCase() : 'SOURCE + CONTEXT') : 'PATTERN PREVIEW'}{!focus && <span className="live-label">LIVE</span>}</div>
    <svg ref={svgRef} className="drawing-canvas" role="img" aria-label={focus ? 'Editable shapes and live repeated context' : 'Live pattern preview, drag to pan'} viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} style={{ background: doc.background }} onPointerDown={start} onPointerMove={move} onPointerUp={() => stop()} onPointerCancel={() => stop(true)} onLostPointerCapture={() => stop()} onWheel={event => zoom(Math.exp(-event.deltaY * 0.0015))}>
      <defs><g id={`motif-${id}`}><MotifPaths doc={doc} /></g></defs>
      <g data-layer="repetitions" opacity={focus ? 0.25 : 1} pointerEvents="none">{copies.filter(c => !focus || !c.source).map(copy => <use key={copy.id} href={`#motif-${id}`} transform={matrixText(copy.matrix)} />)}</g>
      {focus && guides && <g data-layer="geometry-guides" data-geometry={doc.repeat} aria-label={`${guide.label} guides`} pointerEvents="none">
        {guideCopies.map(copy => <path key={copy.id} data-source-cell={copy.source ? 'true' : undefined} d={guide.path} transform={matrixText(guideMatrix(doc, copy))} fill={copy.source ? doc.background : 'none'} fillOpacity=".45" stroke={copy.source ? '#788c5b' : '#909c80'} strokeOpacity={copy.source ? 0.8 : 0.24} strokeDasharray={copy.source ? '5 4' : undefined} strokeWidth={(copy.source ? 1.2 : 0.65) / view.zoom} />)}

      </g>}
      {focus && <g transform={sourceTransform} data-layer="source-shapes">
        {visible.map(shape => <path key={shape.id} data-source-shape={shape.id} d={pathData(shape.points, shape.smooth)} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} strokeLinejoin="round" style={{pointerEvents:editableShape(doc,shape)?'auto':'none'}} className={tool === 'hand' || tool === 'pen' ? '' : 'source-shape'} role="button" tabIndex={tool === 'pen' || !editableShape(doc,shape) ? -1 : 0} aria-label={`Select ${shape.name}`} onFocus={() => { if (!drag.current) onSelect(shape.id) }} onDoubleClick={() => { if (tool !== 'hand' && tool !== 'pen') { onSelect(shape.id); onEditNodes() } }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); onSelect(shape.id); onEditNodes() } }} onPointerDown={event => {
          if (event.button !== 0 || tool === 'hand' || draft.length || !editableShape(doc,shape)) return
          if(tool==='pen'){
            const p=point(event),near=closestSegment(shape,p)
            if(near.distance>8/view.zoom || shape.points.length>=300)return
            event.stopPropagation(); event.preventDefault();const index=near.index+1;onSelect(shape.id,index);dispatch({type:'begin'});dispatch({type:'live',update:d=>updateShape(d,shape.id,s=>{const points=[...s.points];points.splice(index,0,{x:clamp(p.x,-2000,2000),y:clamp(p.y,-2000,2000)});return {...s,points}})});drag.current={kind:'node',id:shape.id,index};svgRef.current?.setPointerCapture(event.pointerId);return
          }
          event.stopPropagation(); event.preventDefault();
          const previous=lastHit.current,now=performance.now();lastHit.current={id:shape.id,time:now,x:event.clientX,y:event.clientY}
          if(tool==='select'&&previous?.id===shape.id&&now-previous.time<400&&Math.hypot(previous.x-event.clientX,previous.y-event.clientY)<6){lastHit.current=null;onSelect(shape.id);onEditNodes();return}
          onSelect(shape.id); dispatch({ type: 'begin' }); drag.current = { kind: 'shape', id: shape.id, original: shape, start: point(event) }; svgRef.current?.setPointerCapture(event.pointerId)
        }} />)}
        {active && !draft.length && <g data-layer="selection">
          {boundsOfActive && tool === 'select' && <><rect {...boundsOfActive} fill="none" stroke="#465f34" strokeWidth={1 / view.zoom} pointerEvents="none" />{handles.map(h=><rect key={h.name} data-resize-handle={h.name} x={boundsOfActive.x+boundsOfActive.width*h.x-3.5/view.zoom} y={boundsOfActive.y+boundsOfActive.height*h.y-3.5/view.zoom} width={7/view.zoom} height={7/view.zoom} fill="#fff" stroke="#465f34" strokeWidth={1/view.zoom} className="resize-handle" style={{cursor:h.x===.5?'ns-resize':h.y===.5?'ew-resize':h.x===h.y?'nwse-resize':'nesw-resize'}} role="button" tabIndex={0} aria-label={`Resize ${h.name}`} onPointerDown={event=>{if(event.button!==0)return;event.stopPropagation();event.preventDefault();dispatch({type:'begin'});drag.current={kind:'resize',id:active.id,original:active,handle:h};svgRef.current?.setPointerCapture(event.pointerId)}} />)}</>}
          {(tool === 'nodes' || tool === 'pen') && <><path d={pathData(active.points, active.smooth)} fill="none" stroke="#334e27" strokeWidth={0.7 / view.zoom} pointerEvents="none" />{active.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(selected === i ? 5 : 3.7) / view.zoom} fill={selected === i ? '#344d2b' : '#fcfcf7'} stroke={selected === i ? '#fcfcf7' : '#344d2b'} strokeWidth={1.5 / view.zoom} className="node" role="button" tabIndex={0} aria-label={`${active.name} node ${i + 1}, x ${Math.round(p.x)}, y ${Math.round(p.y)}`} onFocus={() => onSelect(active.id, i)} onPointerDown={event => { if (event.button !== 0) return; event.stopPropagation(); if(tool==='pen'&&event.altKey){if(active.points.length>3)dispatch({type:'edit',update:d=>updateShape(d,active.id,s=>({...s,points:s.points.filter((_,index)=>index!==i)}))});onSelect(active.id);return} onSelect(active.id, i); dispatch({ type: 'begin' }); drag.current = { kind: 'node', id: active.id, index: i }; svgRef.current?.setPointerCapture(event.pointerId) }} />)}</>}
        </g>}
        {draft.length > 0 && <g data-layer="draft"><path d={pathData(draft)} fill={doc.shapes.find(s => s.id === 'draft')?.fill ?? '#62794c'} fillOpacity=".8" stroke="#405737" strokeWidth={1 / view.zoom} pointerEvents="none" />{draft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 6 : 3) / view.zoom} fill={i === 0 ? '#fff' : '#344d2b'} stroke="#344d2b" strokeWidth={1 / view.zoom} className="node" role={i === 0 ? 'button' : undefined} tabIndex={i === 0 ? 0 : undefined} aria-label={i === 0 ? 'Close contour' : undefined} onKeyDown={event => { if (i === 0 && event.key === 'Enter') { event.stopPropagation(); finishDraft() } }} onPointerDown={event => { if (i === 0) { event.stopPropagation(); finishDraft() } }} />)}</g>}
      </g>}
    </svg>
    {focus && !draft.length && <div className="canvas-help"><span className="help-key">{({ select: 'V', nodes: 'A', pen: 'P', hand: 'H' })[tool]}</span>{tool === 'nodes' ? 'Drag a node to refine a shape.' : tool === 'select' ? 'Drag to move · Shift-resize keeps proportions.' : tool === 'pen' ? 'Click edges to add points · Alt-click points to remove.' : 'Drag to explore the plane.'}</div>}
    {warning && <div className="canvas-warning" role="status">{warning}</div>}
    <div className="zoom-controls"><button aria-label={focus ? 'Zoom out' : 'Preview zoom out'} onClick={() => zoom(1 / 1.2)}><Icon name="minus" size={14} /></button><span>{Math.round(view.zoom * 100)}%</span><button aria-label={focus ? 'Zoom in' : 'Preview zoom in'} onClick={() => zoom(1.2)}><Icon name="plus" size={14} /></button><span className="zoom-divider" /><button aria-label={focus ? 'Reset canvas view' : 'Reset preview view'} title="Reset view" onClick={() => setView({ x: 0, y: 0, zoom: focus ? 1.25 : 0.65 })}><Icon name="fit" size={14} /></button></div>
  </div>
}
