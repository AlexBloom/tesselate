import { useEffect, useId, useRef, useState } from 'react'
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react'
import { guideGeometry, guideMatrix, instances, inversePoint, matrixText, pathData, rotation, translateShape, updateShape } from '../core/geometry'
import type { PatternDocument, Point, Shape } from '../core/geometry'
import type { Action } from '../core/history'
import { Icon } from './controls'
export type Tool = 'select' | 'nodes' | 'pen' | 'hand'
export type View = { x: number; y: number; zoom: number }
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
export function MotifPaths({ doc }: { doc: PatternDocument }) {
  return <>{doc.shapes.filter(s => s.visible).map(shape => <path key={shape.id} data-shape-id={shape.id} d={pathData(shape.points, shape.smooth)} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} strokeLinejoin="round" />)}</>
}
type CanvasProps = {
  doc: PatternDocument; view: View; setView: (v: View | ((v: View) => View)) => void; focus: boolean; guides: boolean; tool: Tool; activeId: string | null; selected: number | null; onSelect: (id: string | null, node?: number | null) => void; onEditNodes: () => void;
  draft: Point[]; onDraftPoint: (p: Point) => void; finishDraft: () => void; dispatch: Dispatch<Action>
}
export function Canvas({ doc, view, setView, focus, guides, tool, activeId, selected, onSelect, onEditNodes, draft, onDraftPoint, finishDraft, dispatch }: CanvasProps) {
  const container = useRef<HTMLDivElement>(null), svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 800, height: 650 })
  const drag = useRef<{ kind: 'node'; id: string; index: number } | { kind: 'shape'; id: string; original: Shape; start: Point } | { kind: 'pan'; x: number; y: number; view: View } | null>(null)
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
    copies = instances(doc, bounds, Math.max(100, Math.floor(8000 / Math.max(1, doc.shapes.filter(s => s.visible).length))))
    if (focus && guides) guideCopies = instances(doc, bounds, 4000, guide.radius)
  } catch (e) { warning = e instanceof Error ? e.message : 'Preview limit reached' }
  const active = doc.shapes.find(s => s.id === activeId && s.visible)
  function point(event: ReactPointerEvent<SVGElement>): Point {
    const svg = svgRef.current!, matrix = svg.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY
    return inversePoint(p.matrixTransform(matrix.inverse()), rotation(doc.angle))
  }
  function start(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.button !== 1) return
    if (!focus || tool === 'hand' || event.button === 1) {
      event.preventDefault(); drag.current = { kind: 'pan', x: event.clientX, y: event.clientY, view }; event.currentTarget.setPointerCapture(event.pointerId)
    } else if (tool === 'pen') { const p = point(event); onDraftPoint({ x: clamp(p.x, -2000, 2000), y: clamp(p.y, -2000, 2000) }) }
    else onSelect(null)
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!current) return
    if (current.kind === 'pan') setView({ ...current.view, x: current.view.x - (event.clientX - current.x) / current.view.zoom, y: current.view.y - (event.clientY - current.y) / current.view.zoom })
    else {
      const p = point(event)
      dispatch({ type: 'live', update: d => updateShape(d, current.id, shape => current.kind === 'shape' ? translateShape(current.original, { x: p.x - current.start.x, y: p.y - current.start.y }) : { ...shape, points: shape.points.map((old, i) => i === current.index ? { x: clamp(p.x, -2000, 2000), y: clamp(p.y, -2000, 2000) } : old) }) })
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
  const sourceTransform = matrixText(rotation(doc.angle))
  const visible = doc.shapes.filter(s => s.visible && s.id !== 'draft')
  const boundsOfActive = active ? { x: Math.min(...active.points.map(p => p.x)), y: Math.min(...active.points.map(p => p.y)), width: Math.max(...active.points.map(p => p.x)) - Math.min(...active.points.map(p => p.x)), height: Math.max(...active.points.map(p => p.y)) - Math.min(...active.points.map(p => p.y)) } : null
  return <div className={`canvas-pane ${focus ? 'focus-pane' : 'pattern-pane'} tool-${tool}`} ref={container}>
    <div className="pane-label"><span className="label-dot" />{focus ? (guides ? guide.label.toUpperCase() : 'SOURCE + CONTEXT') : 'PATTERN PREVIEW'}{!focus && <span className="live-label">LIVE</span>}</div>
    <svg ref={svgRef} className="drawing-canvas" role="img" aria-label={focus ? 'Editable shapes and live repeated context' : 'Live pattern preview, drag to pan'} viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} style={{ background: doc.background }} onPointerDown={start} onPointerMove={move} onPointerUp={() => stop()} onPointerCancel={() => stop(true)} onLostPointerCapture={() => stop()} onWheel={event => zoom(Math.exp(-event.deltaY * 0.0015))}>
      <defs><g id={`motif-${id}`}><MotifPaths doc={doc} /></g></defs>
      <g data-layer="repetitions" opacity={focus ? 0.25 : 1} pointerEvents="none">{copies.filter(c => !focus || !c.source).map(copy => <use key={copy.id} href={`#motif-${id}`} transform={matrixText(copy.matrix)} />)}</g>
      {focus && guides && <g data-layer="geometry-guides" data-geometry={doc.repeat} aria-label={`${guide.label} guides`} pointerEvents="none">
        {guideCopies.map(copy => <path key={copy.id} data-source-cell={copy.source ? 'true' : undefined} d={guide.path} transform={matrixText(guideMatrix(doc, copy))} fill={copy.source ? doc.background : 'none'} fillOpacity=".45" stroke={copy.source ? '#788c5b' : '#909c80'} strokeOpacity={copy.source ? 0.8 : 0.24} strokeDasharray={copy.source ? '5 4' : undefined} strokeWidth={(copy.source ? 1.2 : 0.65) / view.zoom} />)}
        <path d="M-6 0h12M0-6v12" stroke="#788c5b" opacity=".5" strokeWidth={1 / view.zoom} />
      </g>}
      {focus && <g transform={sourceTransform} data-layer="source-shapes">
        {visible.map(shape => <path key={shape.id} data-source-shape={shape.id} d={pathData(shape.points, shape.smooth)} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} strokeLinejoin="round" className={tool === 'hand' || tool === 'pen' ? '' : 'source-shape'} role="button" tabIndex={tool === 'pen' ? -1 : 0} aria-label={`Select ${shape.name}`} onFocus={() => { if (!drag.current) onSelect(shape.id) }} onDoubleClick={() => { if (tool !== 'hand' && tool !== 'pen') { onSelect(shape.id); onEditNodes() } }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); onSelect(shape.id); onEditNodes() } }} onPointerDown={event => {
          if (event.button !== 0 || tool === 'hand' || tool === 'pen' || draft.length) return
          event.stopPropagation(); event.preventDefault(); onSelect(shape.id); dispatch({ type: 'begin' }); drag.current = { kind: 'shape', id: shape.id, original: shape, start: point(event) }; svgRef.current?.setPointerCapture(event.pointerId)
        }} />)}
        {active && !draft.length && <g data-layer="selection">
          {boundsOfActive && tool === 'select' && <rect {...boundsOfActive} fill="none" stroke="#465f34" strokeDasharray="3 3" strokeWidth={1 / view.zoom} pointerEvents="none" />}
          {tool === 'nodes' && <><path d={pathData(active.points, active.smooth)} fill="none" stroke="#334e27" strokeWidth={0.7 / view.zoom} pointerEvents="none" />{active.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(selected === i ? 5 : 3.7) / view.zoom} fill={selected === i ? '#344d2b' : '#fcfcf7'} stroke={selected === i ? '#fcfcf7' : '#344d2b'} strokeWidth={1.5 / view.zoom} className="node" role="button" tabIndex={0} aria-label={`${active.name} node ${i + 1}, x ${Math.round(p.x)}, y ${Math.round(p.y)}`} onFocus={() => onSelect(active.id, i)} onPointerDown={event => { if (event.button !== 0) return; event.stopPropagation(); onSelect(active.id, i); dispatch({ type: 'begin' }); drag.current = { kind: 'node', id: active.id, index: i }; svgRef.current?.setPointerCapture(event.pointerId) }} />)}</>}
        </g>}
        {draft.length > 0 && <g data-layer="draft"><path d={pathData(draft)} fill={doc.shapes.find(s => s.id === 'draft')?.fill ?? '#62794c'} fillOpacity=".8" stroke="#405737" strokeWidth={1 / view.zoom} pointerEvents="none" />{draft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 6 : 3) / view.zoom} fill={i === 0 ? '#fff' : '#344d2b'} stroke="#344d2b" strokeWidth={1 / view.zoom} className="node" role={i === 0 ? 'button' : undefined} tabIndex={i === 0 ? 0 : undefined} aria-label={i === 0 ? 'Close contour' : undefined} onKeyDown={event => { if (i === 0 && event.key === 'Enter') { event.stopPropagation(); finishDraft() } }} onPointerDown={event => { if (i === 0) { event.stopPropagation(); finishDraft() } }} />)}</g>}
      </g>}
    </svg>
    {focus && !draft.length && <div className="canvas-help"><span className="help-key">{({ select: 'V', nodes: 'A', pen: 'P', hand: 'H' })[tool]}</span>{tool === 'nodes' ? 'Drag a node to refine a shape.' : tool === 'select' ? 'Select and drag shapes to compose.' : tool === 'pen' ? 'Draw another shape. Keep building.' : 'Drag to explore the plane.'}</div>}
    {warning && <div className="canvas-warning" role="status">{warning}</div>}
    <div className="zoom-controls"><button aria-label={focus ? 'Zoom out' : 'Preview zoom out'} onClick={() => zoom(1 / 1.2)}><Icon name="minus" size={14} /></button><span>{Math.round(view.zoom * 100)}%</span><button aria-label={focus ? 'Zoom in' : 'Preview zoom in'} onClick={() => zoom(1.2)}><Icon name="plus" size={14} /></button><span className="zoom-divider" /><button aria-label={focus ? 'Reset canvas view' : 'Reset preview view'} title="Reset view" onClick={() => setView({ x: 0, y: 0, zoom: focus ? 1.25 : 0.65 })}><Icon name="fit" size={14} /></button></div>
  </div>
}
