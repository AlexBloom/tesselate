import { useEffect, useId, useRef, useState } from 'react'
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react'
import { guideGeometry, guideMatrix, instances, inversePoint, matrixText, pathData, tileInstance, translateShape, updateShape, visibleShapes, editableShape } from '../core/geometry'
import type { PatternDocument, Point, Shape } from '../core/geometry'
import { primitivePoints, objectBounds, resizeObject } from '../core/objects'
import type { Primitive } from '../core/objects'
import { initialShape } from '../core/geometry'
import type { StackTarget } from '../core/stacking'
import type { Action } from '../core/history'
import { PaintDefinitions } from './Paints'
import { graph, connect, shapePath, moveNode, tangentNode, nearestEdge, splitEdge, removeNode } from '../core/network'
import { shapePaint } from '../core/paint'
import { copyTarget, pasteTarget } from '../core/clipboard'
import { CanvasHelp } from './CanvasHelp'
import { Icon } from './controls'
export type Tool = 'select' | 'nodes' | 'pen' | 'hand' | 'shape'
export type View = { x: number; y: number; zoom: number }
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
export function MotifPaths({ doc }: { doc: PatternDocument }) {
  const prefix=useId().replace(/[^a-zA-Z0-9_-]/g,'')
  return <><PaintDefinitions doc={doc} prefix={prefix}/>{visibleShapes(doc).map(shape => <path key={shape.id} data-shape-id={shape.id} d={shapePath(shape)} fill={shapePaint(doc,shape,prefix,'fill')} stroke={shapePaint(doc,shape,prefix,'stroke')} strokeWidth={shape.strokeWidth} strokeLinejoin={shape.lineJoin??'round'} strokeLinecap={shape.lineCap??'butt'} fillRule={shape.fillRule} opacity={shape.opacity} fillOpacity={shape.fillOpacity} strokeOpacity={shape.strokeOpacity} />)}</>

}
type CanvasProps = {
  penAnchor?:{shapeId:string;node:number}|null; selectedEdge?:number|null; onEdge?:(index:number|null)=>void; onPen?:(p:Point,shapeId?:string,node?:number)=>{shape:Shape;node:number}|null;
  help?: string; placement?: {kind:Primitive;sides:number} | null; onStackMenu?: (target:StackTarget,point:Point)=>void;
  doc: PatternDocument; view: View; setView: (v: View | ((v: View) => View)) => void; focus: boolean; guides: boolean; tool: Tool; proportional: boolean; canDraw: boolean; onPlace:(point:Point,screen:Point)=>void; activeId: string | null; selected: number | null; onSelect: (id: string | null, node?: number | null) => void; onEditNodes: () => void;
  draft: Point[]; onDraftPoint: (p: Point) => void; finishDraft: () => void; dispatch: Dispatch<Action>
}
export function Canvas({ penAnchor, selectedEdge, onEdge, onPen, help, placement, onStackMenu, doc, view, setView, focus, guides, tool, proportional, canDraw, onPlace, activeId, selected, onSelect, onEditNodes, draft, finishDraft, dispatch }: CanvasProps) {
  const container = useRef<HTMLDivElement>(null), svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<Point|null>(null)
  const [size, setSize] = useState({ width: 800, height: 650 })
  const drag = useRef<{ kind: 'node'; id: string; index: number } | { kind: 'shape'; id: string; original: Shape; start: Point } | { kind: 'resize'; id: string; original: Shape; handle: Point } | {kind:'handle';id:string;edge:number;which:'c1'|'c2'} | {kind:'pen-handle';id:string;index:number;original:Shape;start:Point} | { kind: 'pan'; x: number; y: number; view: View } | null>(null)
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
    } else if(tool==='shape'&&canDraw){event.preventDefault();const p=point(event);onPlace({x:clamp(p.x,-2000,2000),y:clamp(p.y,-2000,2000)},{x:event.clientX,y:event.clientY})} else if(tool==='pen'&&canDraw&&onPen){event.preventDefault();const p=point(event);dispatch({type:'begin'});const result=onPen({x:clamp(p.x,-2000,2000),y:clamp(p.y,-2000,2000)});if(result){drag.current={kind:'pen-handle',id:result.shape.id,index:result.node,original:result.shape,start:p};event.currentTarget.setPointerCapture(event.pointerId)}else dispatch({type:'end'})}
    else onSelect(null)
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drag.current
    if(focus&&(tool==='shape'||tool==='pen')&&canDraw)setHover(point(event))
    if (!current) return
    if (current.kind === 'pan') setView({ ...current.view, x: current.view.x - (event.clientX - current.x) / current.view.zoom, y: current.view.y - (event.clientY - current.y) / current.view.zoom })
    else {
      if(current.kind==='shape'&&Math.hypot(event.movementX,event.movementY)>1)lastHit.current=null
      const p = point(event)
      if(current.kind==='pen-handle'){
        if(Math.hypot(p.x-current.start.x,p.y-current.start.y)>2/view.zoom)dispatch({type:'live',update:d=>updateShape(d,current.id,()=>tangentNode(current.original,current.index,{x:p.x-current.start.x,y:p.y-current.start.y}))})
      }else if(current.kind==='handle'){
        dispatch({type:'live',update:d=>updateShape(d,current.id,s=>{const g=graph(s),edge=g.edges[current.edge],node=current.which==='c1'?edge.from:edge.to,anchor=g.points[node],q={x:clamp(p.x,-2000,2000),y:clamp(p.y,-2000,2000)};if(!event.altKey)return tangentNode(g,node,{x:(q.x-anchor.x)*(current.which==='c1'?1:-1),y:(q.y-anchor.y)*(current.which==='c1'?1:-1)});return {...g,edges:g.edges.map((e,i)=>i===current.edge?{...e,[current.which]:q}:e)}})})
      }else dispatch({ type: 'live', update: d => updateShape(d, current.id, shape => current.kind === 'resize' ? resizeObject(current.original,current.handle,p,event.shiftKey||proportional,event.altKey) : current.kind === 'shape' ? translateShape(current.original, { x: p.x - current.start.x, y: p.y - current.start.y }) : moveNode(shape,current.index,{x:clamp(p.x,-2000,2000),y:clamp(p.y,-2000,2000)})) })
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
  const penGhost=tool==='pen'&&active&&hover&&penAnchor?.shapeId===active.id?connect({...graph(active),points:[...active.points,hover]},penAnchor.node,active.points.length):null
  const boundsOfActive = active ? objectBounds(active) : null
  const handles = [{x:0,y:0,name:'top left'},{x:.5,y:0,name:'top'},{x:1,y:0,name:'top right'},{x:1,y:.5,name:'right'},{x:1,y:1,name:'bottom right'},{x:.5,y:1,name:'bottom'},{x:0,y:1,name:'bottom left'},{x:0,y:.5,name:'left'}]

  return <div className={`canvas-pane ${focus ? 'focus-pane' : 'pattern-pane'} tool-${tool}`} ref={container}>
    <div className="pane-label"><span className="label-dot" />{focus ? (guides ? guide.label.toUpperCase() : 'SOURCE + CONTEXT') : 'PATTERN PREVIEW'}{!focus && <span className="live-label">LIVE</span>}</div>
    <svg ref={svgRef} className="drawing-canvas" role="img" aria-label={focus ? 'Editable shapes and live repeated context' : 'Live pattern preview, drag to pan'} viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} style={{ background: doc.background }} onPointerDown={start} onPointerMove={move} onPointerLeave={()=>setHover(null)} onPointerUp={() => stop()} onPointerCancel={() => stop(true)} onLostPointerCapture={() => stop()} onWheel={event => zoom(Math.exp(-event.deltaY * 0.0015))}>
      <PaintDefinitions doc={doc} prefix={id}/><rect {...bounds} fill={doc.backgroundGradient?`url(#${id}-background)`:doc.background} pointerEvents="none"/>
      <defs><g id={`motif-${id}`}><MotifPaths doc={doc} /></g></defs>
      <g data-layer="repetitions" opacity={focus ? 0.25 : 1} pointerEvents="none">{copies.filter(c => !focus || !c.source).map(copy => <use key={copy.id} href={`#motif-${id}`} transform={matrixText(copy.matrix)} />)}</g>
      {focus && guides && <g data-layer="geometry-guides" data-geometry={doc.repeat} aria-label={`${guide.label} guides`} pointerEvents="none">
        {guideCopies.map(copy => <path key={copy.id} data-source-cell={copy.source ? 'true' : undefined} d={guide.path} transform={matrixText(guideMatrix(doc, copy))} fill={copy.source&&!doc.backgroundGradient ? doc.background : 'none'} fillOpacity=".45" stroke={copy.source ? '#555555' : '#808080'} strokeOpacity={copy.source ? 0.8 : 0.24} strokeDasharray={copy.source ? '5 4' : undefined} strokeWidth={(copy.source ? 1.2 : 0.65) / view.zoom} />)}

      </g>}
      {focus && <g transform={sourceTransform} data-layer="source-shapes">
        {visible.map(shape => <path key={shape.id} onContextMenu={event=>{if(onStackMenu){event.preventDefault();event.stopPropagation();onSelect(shape.id);onStackMenu({kind:"object",id:shape.id},{x:event.clientX,y:event.clientY})}}} data-source-shape={shape.id} d={shapePath(shape)} fill={shapePaint(doc,shape,id,'fill')} stroke={shapePaint(doc,shape,id,'stroke')} strokeWidth={shape.strokeWidth} strokeLinejoin={shape.lineJoin??'round'} strokeLinecap={shape.lineCap??'butt'} fillRule={shape.fillRule} opacity={shape.opacity} fillOpacity={shape.fillOpacity} strokeOpacity={shape.strokeOpacity} style={{pointerEvents:editableShape(doc,shape)?'auto':'none'}} className={tool === 'hand' || tool === 'pen' ? '' : 'source-shape'} role="button" tabIndex={tool === 'pen' || tool==='shape' || !editableShape(doc,shape) ? -1 : 0} aria-label={`Select ${shape.name}`} onFocus={() => { if (!drag.current&&tool!=='shape') onSelect(shape.id) }} onDoubleClick={() => { if (tool !== 'hand' && tool !== 'pen' && tool!=='shape') { onSelect(shape.id); onEditNodes() } }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); onSelect(shape.id); onEditNodes() } }} onPointerDown={event => {
          if (event.button !== 0 || tool === 'hand' || tool==='shape' || draft.length || !editableShape(doc,shape)) return
          if(tool==='pen'){
            const near=nearestEdge(shape,point(event));if(near.distance>8/view.zoom)return
            event.stopPropagation();event.preventDefault();onSelect(shape.id)
            if(event.shiftKey){const result=splitEdge(shape,near.index,near.t);dispatch({type:'edit',update:d=>updateShape(d,shape.id,()=>result.shape)});onSelect(shape.id,result.node);onEdge?.(null)}else onEdge?.(near.index)
            return
          }
          event.stopPropagation(); event.preventDefault();
          if(event.altKey && tool==='select'){
            const data=copyTarget(doc,{kind:'object',id:shape.id}),result=data&&pasteTarget(doc,data,shape.layerId,()=>crypto.randomUUID(),{x:0,y:0})
            if(!result)return
            const copy=result.doc.shapes.find(s=>s.id===result.target.id)!
            lastHit.current=null;dispatch({type:'begin'});dispatch({type:'live',update:()=>result.doc});onSelect(copy.id);drag.current={kind:'shape',id:copy.id,original:copy,start:point(event)};svgRef.current?.setPointerCapture(event.pointerId);return
          }
          const previous=lastHit.current,now=performance.now();lastHit.current={id:shape.id,time:now,x:event.clientX,y:event.clientY}
          if(tool==='select'&&previous?.id===shape.id&&now-previous.time<400&&Math.hypot(previous.x-event.clientX,previous.y-event.clientY)<6){lastHit.current=null;onSelect(shape.id);onEditNodes();return}
          onSelect(shape.id); dispatch({ type: 'begin' }); drag.current = { kind: 'shape', id: shape.id, original: shape, start: point(event) }; svgRef.current?.setPointerCapture(event.pointerId)
        }} />)}
        {active && !draft.length && <g data-layer="selection">
          {boundsOfActive && tool === 'select' && <><rect {...boundsOfActive} fill="none" stroke="#414141" strokeWidth={1 / view.zoom} pointerEvents="none" />{handles.map(h=><rect key={h.name} data-resize-handle={h.name} x={boundsOfActive.x+boundsOfActive.width*h.x-3.5/view.zoom} y={boundsOfActive.y+boundsOfActive.height*h.y-3.5/view.zoom} width={7/view.zoom} height={7/view.zoom} fill="#fff" stroke="#414141" strokeWidth={1/view.zoom} className="resize-handle" style={{cursor:h.x===.5?'ns-resize':h.y===.5?'ew-resize':h.x===h.y?'nwse-resize':'nesw-resize'}} role="button" tabIndex={0} aria-label={`Resize ${h.name}`} onPointerDown={event=>{if(event.button!==0)return;event.stopPropagation();event.preventDefault();dispatch({type:'begin'});drag.current={kind:'resize',id:active.id,original:active,handle:h};svgRef.current?.setPointerCapture(event.pointerId)}} />)}</>}
          {(tool==='nodes'||tool==='pen')&&<>
            <path d={shapePath(active)} fill="none" stroke="#292929" strokeWidth={.7/view.zoom} pointerEvents="none"/>
            {selectedEdge!==null&&selectedEdge!==undefined&&graph(active).edges[selectedEdge]&&<path data-selected-edge={selectedEdge} d={shapePath({...graph(active),edges:[graph(active).edges[selectedEdge]]})} fill="none" stroke="#2563eb" strokeWidth={2/view.zoom} pointerEvents="none"/>}
            {graph(active).edges.flatMap((edge,index)=>(['c1','c2'] as const).map(which=>{const control=edge[which],node=which==='c1'?edge.from:edge.to;if(!control||(selected!==node&&selectedEdge!==index))return null;const p=active.points[node];return <g key={`${index}-${which}`}><line x1={p.x} y1={p.y} x2={control.x} y2={control.y} stroke="#2563eb" strokeWidth={1/view.zoom} pointerEvents="none"/><circle data-control-handle={`${index}-${which}`} cx={control.x} cy={control.y} r={3.5/view.zoom} fill="#fff" stroke="#2563eb" strokeWidth={1/view.zoom} role="button" tabIndex={0} aria-label={`Curve handle ${index+1} ${which}`} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();dispatch({type:'begin'});drag.current={kind:'handle',id:active.id,edge:index,which};svgRef.current?.setPointerCapture(event.pointerId)}}/></g>}))}
            {active.points.map((p,i)=><circle key={i} data-node-index={i} cx={p.x} cy={p.y} r={(selected===i?5:3.7)/view.zoom} fill={selected===i?'#292929':'#fff'} stroke={penAnchor?.shapeId===active.id&&penAnchor.node===i?'#2563eb':'#292929'} strokeWidth={1.5/view.zoom} className="node" role="button" tabIndex={0} aria-label={`${active.name} node ${i+1}, x ${Math.round(p.x)}, y ${Math.round(p.y)}`} onFocus={()=>onSelect(active.id,i)} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();if(tool==='pen'&&event.altKey){if(active.points.length>1)dispatch({type:'edit',update:d=>updateShape(d,active.id,s=>removeNode(s,i))});onSelect(active.id);return}if(tool==='pen'&&onPen){dispatch({type:'begin'});const result=onPen(p,active.id,i);if(result){drag.current={kind:'pen-handle',id:result.shape.id,index:result.node,original:result.shape,start:p};svgRef.current?.setPointerCapture(event.pointerId)}else dispatch({type:'end'});return}onSelect(active.id,i);dispatch({type:'begin'});drag.current={kind:'node',id:active.id,index:i};svgRef.current?.setPointerCapture(event.pointerId)}}/>)}
          </>}
        </g>}
        {draft.length > 0 && <g data-layer="draft"><path d={pathData(draft)} fill={doc.shapes.find(s => s.id === 'draft')?.fill ?? initialShape.fill} fillOpacity=".8" stroke={initialShape.stroke} strokeWidth={initialShape.strokeWidth} pointerEvents="none" />{draft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 6 : 3) / view.zoom} fill={i === 0 ? '#fff' : '#292929'} stroke="#292929" strokeWidth={1 / view.zoom} className="node" role={i === 0 ? 'button' : undefined} tabIndex={i === 0 ? 0 : undefined} aria-label={i === 0 ? 'Close contour' : undefined} onKeyDown={event => { if (i === 0 && event.key === 'Enter') { event.stopPropagation(); finishDraft() } }} onPointerDown={event => { if (i === 0) { event.stopPropagation(); finishDraft() } }} />)}</g>}
      </g>}
      {focus&&penGhost&&<path transform={sourceTransform} data-layer="pen-preview" d={shapePath({...penGhost,edges:penGhost.edges?.slice(-1)})} fill="none" stroke="#2563eb" strokeDasharray="4 3" strokeWidth={1/view.zoom} pointerEvents="none"/>}
      {focus && tool==='shape' && canDraw && placement && hover && <g transform={sourceTransform} pointerEvents="none" data-layer="placement-preview"><path d={pathData(translateShape({...initialShape,...primitivePoints(placement.kind,100,100,placement.sides)},hover).points,placement.kind==='ellipse'?1:0)} fill="none" stroke="#292929" strokeWidth={1.5/view.zoom} strokeDasharray={`${5/view.zoom} ${3/view.zoom}`} /></g>}
    </svg>

    {focus && help && <CanvasHelp shortcut={({select:'V',nodes:'A',pen:'P',hand:'H',shape:'+'})[tool]} text={help}/>}
    {warning && <div className="canvas-warning" role="status">{warning}</div>}
    <div className="zoom-controls"><button aria-label={focus ? 'Zoom out' : 'Preview zoom out'} onClick={() => zoom(1 / 1.2)}><Icon name="minus" size={14} /></button><span>{Math.round(view.zoom * 100)}%</span><button aria-label={focus ? 'Zoom in' : 'Preview zoom in'} onClick={() => zoom(1.2)}><Icon name="plus" size={14} /></button><span className="zoom-divider" /><button aria-label={focus ? 'Reset canvas view' : 'Reset preview view'} title="Reset view" onClick={() => setView({ x: 0, y: 0, zoom: focus ? 1.25 : 0.65 })}><Icon name="fit" size={14} /></button></div>
  </div>
}
