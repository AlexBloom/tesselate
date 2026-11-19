import { useEffect, useReducer, useState } from 'react'
import { addShape, exportSVG, initialDocument, initialShape, instances, matrixText, migrateDocument, removeShape, translateShape, updateShape, tileOptions } from './core/geometry'
import type { PatternDocument, Point, Shape } from './core/geometry'
import { history, reducer } from './core/history'
import { Canvas, MotifPaths } from './components/Canvas'
import type { Tool, View } from './components/Canvas'
import { primitivePoints } from './core/objects'
import type { Primitive } from './core/objects'
import { stack, canStack } from './core/stacking'
import type { StackTarget, StackAction } from './core/stacking'
import { StackMenu } from './components/StackMenu'
import { LayerTree } from './components/LayerTree'
import { RailMenu } from './components/RailMenu'
import { ShapeMenu } from './components/ShapeMenu'
import { RepeatPanels } from './components/RepeatPanels'
import { ObjectPanels } from './components/ObjectPanels'
import { PolygonPlacement } from './components/PolygonPlacement'
import { Icon, Panel } from './components/controls'
import './App.css'

const storageKey = 'tesselate-gpt.document.v3'
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const palettes = [['#ffffff', '#eeeeee'], ['#62794c', '#f4f2e9'], ['#b45e47', '#f6e8d7'], ['#415c80', '#edf1f2'], ['#ae7844', '#f4eddb'], ['#825c81', '#f2e8ee'], ['#e5c77a', '#293e37']]
function loadDocument(): PatternDocument {
  for(const key of [storageKey,'tesselate-gpt.document.v2','tesselate-gpt.document.v1']){
    try { const doc=migrateDocument(JSON.parse(localStorage.getItem(key)??'null'));if(doc)return doc } catch { /* Try the previous saved version. */ }
  }
  return initialDocument
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => history(loadDocument()))
  const doc = state.present
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(() => doc.shapes.at(-1)?.id ?? null)
  const [selectedLayerId,setSelectedLayerId]=useState(()=>doc.layers.at(-1)!.id)
  const [shapeMenuOpen,setShapeMenuOpen]=useState(false)
  const [placementKind,setPlacementKind]=useState<Primitive|null>('rectangle')
  const [stackMenu,setStackMenu]=useState<{target:StackTarget;point:Point}|null>(null)
  const openStackMenu=(target:StackTarget,point:Point)=>setStackMenu({target,point})
  const applyStack=(target:StackTarget,action:StackAction)=>dispatch({type:"edit",update:d=>stack(d,target,action)})
  const [pendingPolygon,setPendingPolygon]=useState<{point:Point;screen:Point}|null>(null)
  const [polygonSides,setPolygonSides]=useState(6)
  const [aspectLocked,setAspectLocked]=useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const active = doc.shapes.find(s => s.id === selectedId)
  const activeLayer=doc.layers.find(l=>l.id===(active?.layerId??selectedLayerId))??doc.layers[0]
  const canInsert=activeLayer.visible&&!activeLayer.locked&&doc.shapes.length<64
  const canEdit=Boolean(active&&!doc.layers.find(l=>l.id===active.layerId)?.locked)
  const [draft, setDraft] = useState<Point[]>([])
  const [split, setSplit] = useState(false)
  const [guides, setGuides] = useState(true)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [panels, setPanels] = useState<Record<string, boolean>>({ tools: true, library: true, layers: true, geometry: true, tiles: true, placement: false, transform: true, contour: false, appearance: false })
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1.25 })
  const [previewView, setPreviewView] = useState<View>({ x: 0, y: 0, zoom: 0.65 })
  const [exportOpen, setExportOpen] = useState(false)
  const [width, setWidth] = useState(1600)
  const [height, setHeight] = useState(1200)
  const [exportScale, setExportScale] = useState(100)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const [savedDocument, setSavedDocument] = useState(doc)
  const saved = savedDocument === doc && !state.gesture
  const [storageError, setStorageError] = useState(false)
  const begin = () => dispatch({ type: 'begin' })
  const end = () => dispatch({ type: 'end' })
  const change = <K extends keyof PatternDocument>(key: K, value: PatternDocument[K]) => dispatch({ type: state.gesture ? 'live' : 'edit', update: d => ({ ...d, tileOptions: tileOptions(d), [key]: value }) })
  const changeShape = <K extends keyof Shape>(key: K, value: Shape[K]) => { if (active && canEdit) dispatch({ type: state.gesture ? 'live' : 'edit', update: d => updateShape(d, active.id, shape => ({ ...shape, [key]: value })) }) }
  const selectShape = (id: string | null, node: number | null = null) => { setSelectedId(id); setSelected(node);const object=doc.shapes.find(s=>s.id===id);if(object)setSelectedLayerId(object.layerId) }
  const panelProps = (id: string) => ({ id, open: panels[id], onOpenChange: (open: boolean) => setPanels(p => ({ ...p, [id]: open })) })
  function activateTool(next: Tool) { setTool(next); setDraft([]); setSelected(null);setPendingPolygon(null) }
  function insert(shape: Shape) {
    if (!canInsert) return
    dispatch({ type: 'edit', update: d => addShape(d, {...shape,layerId:activeLayer.id}) }); setDraft([]); selectShape(shape.id); setTool('select');setPendingPolygon(null); setPanels(p => ({ ...p, layers: true,transform:true }))
  }
  function placePrimitive(kind:Primitive,point:Point,sides=6) {
    if(!canInsert)return
    const count=doc.shapes.length, geometry=primitivePoints(kind,100,100,sides)
    insert(translateShape({...initialShape,...geometry,id:crypto.randomUUID(),layerId:activeLayer.id,name:`${kind==='ellipse'?'Ellipse':kind==='rectangle'?'Rectangle':'Polygon'} ${count+1}`},point))
  }
  function choosePrimitive(kind:Primitive){setPlacementKind(kind);activateTool('shape');selectShape(null)}
  function placeOnCanvas(point:Point,screen:Point){if(!canInsert||!placementKind)return;if(placementKind==='polygon')setPendingPolygon({point,screen});else placePrimitive(placementKind,point)}
  function duplicateShape() {
    if (!active || !canEdit || !canInsert) return
    insert(translateShape({ ...active, id: crypto.randomUUID(), name: `${active.name} copy`.slice(0, 80) }, { x: 20, y: 20 }))
  }
  function deleteShape() {
    if (!active || !canEdit) return
    dispatch({ type: 'edit', update: d => removeShape(d, active.id) }); setSelectedId(null); setSelected(null)
  }
  function reorderShape(direction: number) {
    if (!active || !canEdit) return
    applyStack({kind:'object',id:active.id},direction>0?'forward':'backward')
  }

  function finishDraft() {
    if (draft.length < 3 || !canInsert) return
    const shape = { ...initialShape, id: crypto.randomUUID(), layerId:activeLayer.id, name: `Path ${doc.shapes.length + 1}`, points: draft, smooth: 0 }
    insert(shape); setTool('nodes'); setSelected(0)
  }
  function addNode() {
    if (!active || !canEdit || active.points.length >= 300) return
    const i = selected ?? 0, a = active.points[i], b = active.points[(i + 1) % active.points.length]
    const points = [...active.points]; points.splice(i + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    changeShape('points', points); setSelected(i + 1); setTool('nodes')
  }
  const undo = () => { if (draft.length) { setDraft(d => d.slice(0, -1)); return } setSelected(null); dispatch({ type: 'undo' }) }
  const redo = () => { setSelected(null); dispatch({ type: 'redo' }) }
  useEffect(() => {
    if (state.gesture) return
    const timeout = window.setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(doc)); setSavedDocument(doc); setStorageError(false) } catch { setStorageError(true) }
    }, 350)
    return () => clearTimeout(timeout)
  }, [doc, state.gesture])
  useEffect(() => { if (!message) return; const timeout = setTimeout(() => setMessage(''), 6000); return () => clearTimeout(timeout) }, [message])
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, select, textarea')) return
      if (event.key === 'Escape') { dispatch({ type: 'cancel' }); setDraft([]);setPendingPolygon(null);if(tool==='shape')setTool('select'); setExportOpen(false);setStackMenu(null); return }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (draft.length && !event.shiftKey) setDraft(d => d.slice(0, -1)); else { setDraft([]); setSelected(null); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }) } return }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && !exportOpen) { event.preventDefault(); duplicateShape(); return }
      if ((event.metaKey || event.ctrlKey) && !exportOpen && (event.code === 'BracketLeft' || event.code === 'BracketRight')) {
        event.preventDefault()
        const target:StackTarget=active?{kind:'object',id:active.id}:{kind:'layer',id:activeLayer.id}
        applyStack(target,event.code==='BracketRight'?(event.shiftKey?'front':'forward'):(event.shiftKey?'back':'backward')); return
      }
      if (event.metaKey || event.ctrlKey || event.altKey || exportOpen) return
      if (event.key === 'v') activateTool('select')
      if (event.key === 'a') activateTool('nodes')
      if (event.key === 'p') { if (canInsert) activateTool('pen') }
      if (event.key === 'h') activateTool('hand')
      if (event.key === 'Enter' && draft.length >= 3) finishDraft()
      if (active && canEdit && !draft.length) {
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault()
          if (selected !== null && (tool === 'nodes' || tool === 'pen')) { if (active.points.length > 3) { changeShape('points', active.points.filter((_, i) => i !== selected)); setSelected(null) } }
          else deleteShape()
        }
        const arrows: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
        const delta = arrows[event.key]
        if (delta) {
          event.preventDefault(); const step = event.shiftKey ? 10 : 1
          dispatch({ type: 'edit', update: d => updateShape(d, active.id, shape => selected !== null && (tool === 'nodes' || tool === 'pen') ? { ...shape, points: shape.points.map((p, i) => i === selected ? { x: clamp(p.x + delta.x * step, -2000, 2000), y: clamp(p.y + delta.y * step, -2000, 2000) } : p) } : translateShape(shape, { x: delta.x * step, y: delta.y * step })) })
        }
      }
    }
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle)
  })
  const liveDoc = draft.length >= 2 ? { ...doc, shapes: [...doc.shapes, { ...initialShape, id: 'draft', layerId:activeLayer.id, name: 'Draft', points: draft, smooth: 0 }] } : doc
  async function download(format: 'svg' | 'png') {
    setExporting(true)
    try {
      if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error('Enter whole-number output dimensions.')
      if (format === 'png' && (width > 8192 || height > 8192 || width * height > 32000000)) throw new Error('PNG limit: 8192 px per side and 32 megapixels. Reduce the dimensions.')
      const source = exportSVG(doc, width, height, exportScale / 100)
      let blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
      if (format === 'png') {
        const url = URL.createObjectURL(blob)
        try {
          const image = new Image()
          await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not render the image.')); image.src = url })
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
          const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable.')
          ctx.drawImage(image, 0, 0, width, height)
          blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG encoding failed.')), 'image/png'))
        } finally { URL.revokeObjectURL(url) }
      }
      const url = URL.createObjectURL(blob), anchor = document.createElement('a')
      anchor.href = url; anchor.download = `tesselate-${width}x${height}.${format}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage(`${format.toUpperCase()} exported · ${width} × ${height}`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Export failed.') }
    finally { setExporting(false) }
  }

  const objectControls=(only?:string)=><ObjectPanels only={only} doc={doc} active={active} canEdit={canEdit} selected={selected} tool={tool} aspectLocked={aspectLocked} setAspectLocked={setAspectLocked} panels={only?{[only]:true}:panels} setPanel={(id,open)=>setPanels(p=>({...p,[id]:open}))} dispatch={dispatch} changeShape={changeShape} begin={begin} end={end} onEditMode={()=>{setTool(tool==='nodes'||tool==='pen'?'select':'nodes');setSelected(null);setDraft([]);setPendingPolygon(null)}} onAddNode={addNode} onReorder={reorderShape} onClearPoint={()=>setSelected(null)} onFinish={finishDraft} draftLength={draft.length} palettes={palettes}/>
  const layerControls=<LayerTree onStackMenu={openStackMenu} doc={doc} active={active} layerId={activeLayer.id} onLayer={id=>{setSelectedLayerId(id);setSelectedId(null);setSelected(null);setDraft([]);setPendingPolygon(null)}} onObject={id=>{selectShape(id);activateTool('select')}} dispatch={dispatch} onDuplicate={duplicateShape} onDelete={deleteShape}/>
  const repeatControls=(only?:string)=><RepeatPanels only={only} doc={doc} change={change} begin={begin} end={end} panels={only?{[only]:true}:panels} setPanel={(id,open)=>setPanels(p=>({...p,[id]:open}))} guides={guides} setGuides={setGuides} dispatch={dispatch}/>
  const toolHint=draft.length?`${draft.length} points · Enter to close · Esc to cancel`:tool==='shape'?`Click to place a ${placementKind??'shape'}`:tool==='hand'?'Drag to pan · Scroll to zoom':tool==='pen'?'Click edges to add points · Alt-click points to remove':tool==='nodes'?'Drag nodes · Arrow keys to nudge · Shift for 10×':'Drag to move · Shift-resize locks proportions · Double-click for points'

  return <div className="app-shell">
    <div className="workspace">
      <aside className={`left-panel ${leftCollapsed ? 'dock-collapsed' : ''}`} aria-label="Workspace panels">
        <div className="dock-header studio-brand-header"><div className="brand" aria-label="Tesselate"><span className="brand-mark">✳</span>{!leftCollapsed&&<span>tesselate</span>}</div><button className="icon-button" aria-label={leftCollapsed ? 'Expand workspace' : 'Collapse workspace'} aria-expanded={!leftCollapsed} title={leftCollapsed ? 'Expand workspace' : 'Collapse workspace'} onClick={() => setLeftCollapsed(!leftCollapsed)}><Icon name="left" size={16} /></button></div>
        {leftCollapsed ? <div className="dock-rail">{(['select','nodes','pen','hand'] as Tool[]).map((t,i)=><button key={t} className={`icon-button ${tool===t?'selected':''}`} aria-label={['Arrow tool','Direct selection tool','Pen tool','Pan canvas'][i]} title={['Arrow (V)','Points (A)','Pen (P)','Pan (H)'][i]} disabled={t==='pen'&&!canInsert} onClick={()=>activateTool(t)}><Icon name={t} size={17}/></button>)}<span className="rail-divider"/>
          <RailMenu title="Shapes" icon="shapes" side="left"><div className="rail-shapes">{(['rectangle','ellipse','polygon'] as Primitive[]).map((kind,i)=><button data-close-rail key={kind} disabled={!canInsert} aria-pressed={tool==='shape'&&placementKind===kind} onClick={()=>choosePrimitive(kind)}><Icon name={['square','circle','hex'][i]} size={17}/>{['Rectangle / square','Ellipse / circle','Polygon'][i]}</button>)}</div></RailMenu>
          <RailMenu title="Layers" icon="layers" side="left">{layerControls}</RailMenu>
          {([['transform','fit','Transform'],['contour','nodes','Object'],['appearance','palette','Fill & stroke']] as const).map(([key,icon,title])=><RailMenu key={key} title={title} icon={icon} side="left">{objectControls(key)}</RailMenu>)}
        </div> : <div className="dock-scroll">
          <Panel {...panelProps('tools')} title="Tools" icon="select"><div className="tools">{(['select','nodes','pen','hand'] as Tool[]).map((t,i)=><button key={t} className={tool===t?'tool active':'tool'} title={`${['Arrow','Direct selection','Pen','Pan'][i]} (${['V','A','P','H'][i]})`} aria-label={['Arrow tool','Direct selection tool','Pen tool','Pan canvas'][i]} disabled={t==='pen'&&!canInsert} aria-pressed={tool===t} onClick={()=>activateTool(t)}><Icon name={t} size={17}/><span>{['Arrow','Points','Pen','Pan'][i]}</span></button>)}</div><ShapeMenu open={shapeMenuOpen} setOpen={setShapeMenuOpen} disabled={!canInsert} selected={tool==='shape'?placementKind:null} onSelect={choosePrimitive}/>{!canInsert&&<p className="field-note">{doc.shapes.length>=64?'Object limit reached (64).':'Show and unlock a layer to add objects.'}</p>}</Panel>
          <Panel {...panelProps('layers')} title="Layers" icon="layers">{layerControls}</Panel>
          {objectControls()}
        </div>}
        <div tabIndex={leftCollapsed?0:undefined} aria-label={leftCollapsed?toolHint:undefined} className={`tool-help ${leftCollapsed?'compact':''}`}><span className="help-key">{({select:'V',nodes:'A',pen:'P',hand:'H',shape:'+'})[tool]}</span><span>{toolHint}</span></div>
      </aside>
      <main className="studio">
        <div className="canvas-toolbar"><div className="history-actions"><button className="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl Z)" disabled={!state.past.length && !state.gesture && !draft.length} onClick={undo}><Icon name="undo" /></button><button className="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)" disabled={!state.future.length} onClick={redo}><Icon name="redo" /></button><span className="toolbar-divider" /><div className="pattern-title-area"><input aria-label="Pattern title" maxLength={120} value={doc.title??'Untitled pattern'} onChange={e=>change('title',e.target.value)}/><span className={storageError?'save-status error':'save-status'}>{storageError?'Local save unavailable':draft.length?'Drawing…':saved?'Saved on this device':'Saving…'}</span></div></div><div className="canvas-actions"><button className={`split-button ${split ? 'selected' : ''}`} aria-pressed={split} onClick={() => setSplit(!split)}><Icon name="split" size={16} /><span>Split preview</span></button></div></div>
        <div className={`canvases ${split ? 'is-split' : ''}`}>
          <Canvas placement={!pendingPolygon&&placementKind?{kind:placementKind,sides:polygonSides}:null} onStackMenu={openStackMenu} doc={liveDoc} view={view} setView={setView} focus guides={guides} tool={tool} proportional={aspectLocked} canDraw={canInsert} onPlace={placeOnCanvas} activeId={active?.id ?? null} selected={selected} onSelect={selectShape} onEditNodes={() => setTool('nodes')} draft={draft} onDraftPoint={p => setDraft(prev => [...prev, p].slice(0, 300))} finishDraft={finishDraft} dispatch={dispatch} />
          {split && <Canvas doc={liveDoc} view={previewView} setView={setPreviewView} focus={false} guides={false} tool="hand" proportional={false} canDraw={false} onPlace={()=>{}} activeId={null} selected={null} onSelect={() => {}} onEditNodes={() => {}} draft={[]} onDraftPoint={() => {}} finishDraft={() => {}} dispatch={dispatch} />}
        </div>
        <div className="canvas-status"><span><span className="green-dot"/>Live preview</span><span>{doc.repeat==='radial'?`${doc.sectors} sectors`:'Live repetition'}</span></div>
      </main>
      <aside className={`right-panel ${rightCollapsed ? 'dock-collapsed' : ''}`} aria-label="Inspector panels">
        <div className="dock-header"><span>PATTERN</span><button className="icon-button" aria-label={rightCollapsed ? 'Expand inspector' : 'Collapse inspector'} aria-expanded={!rightCollapsed} title={rightCollapsed ? 'Expand inspector' : 'Collapse inspector'} onClick={() => setRightCollapsed(!rightCollapsed)}><Icon name="right" size={16} /></button></div>
        {rightCollapsed ? <div className="dock-rail">{[['geometry','hex','Repeat geometry'],['tiles','rotate','Tile transforms'],['placement','grid','Pattern placement']].map(([key,icon,title])=><RailMenu key={key} title={title} icon={icon} side="right">{repeatControls(key)}</RailMenu>)}</div> : <div className="dock-scroll">
          {repeatControls()}

        </div>}
        <div className="export-dock"><button className="primary" disabled={draft.length>0||Boolean(pendingPolygon)} title="Export pattern" aria-label="Export pattern" onClick={()=>setExportOpen(true)}><Icon name="download" size={16}/>{!rightCollapsed&&<span>Export pattern</span>}</button></div>
      </aside>
    </div>
    {stackMenu&&<StackMenu point={stackMenu.point} target={stackMenu.target} can={action=>canStack(doc,stackMenu.target,action)} onAction={action=>applyStack(stackMenu.target,action)} onClose={()=>setStackMenu(null)}/>}
    {pendingPolygon&&<PolygonPlacement screen={pendingPolygon.screen} sides={polygonSides} setSides={setPolygonSides} onPlace={()=>placePrimitive('polygon',pendingPolygon.point,polygonSides)} onCancel={()=>setPendingPolygon(null)}/>}
    {message && <div className="toast" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><Icon name="close" size={14} /></button></div>}
    {exportOpen && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setExportOpen(false) }}><div className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title" onKeyDown={e => { if (e.key === 'Escape') setExportOpen(false); if (e.key === 'Tab') { const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input')); const first = els[0], last = els.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() } } }}><div className="modal-heading"><div><p className="eyebrow">FROM EXPLORATION TO ARTWORK</p><h2 id="export-title">Export your pattern</h2></div><button className="icon-button" aria-label="Close export" autoFocus onClick={() => setExportOpen(false)}><Icon name="close" /></button></div><div className="export-thumbnail" style={{ background: doc.background }}><svg viewBox="-260 -100 520 200"><defs><g id="export-thumb-motif"><MotifPaths doc={doc} /></g></defs>{instances(doc, { x: -260, y: -100, width: 520, height: 200 }).map(c => <use key={c.id} href="#export-thumb-motif" transform={matrixText(c.matrix)} />)}</svg></div><div className="export-dimensions"><label>Width, px<input aria-label="Export width" type="number" min={1} max={16000} value={width} onChange={e => setWidth(e.target.valueAsNumber || 0)} /></label><span>×</span><label>Height, px<input aria-label="Export height" type="number" min={1} max={16000} value={height} onChange={e => setHeight(e.target.valueAsNumber || 0)} /></label></div><label className="export-scale">Pattern scale<span><input aria-label="Export pattern scale" type="number" min={25} max={400} value={exportScale} onChange={e => setExportScale(e.target.valueAsNumber || 0)} />%</span></label><p className="field-note">Exports every visible shape in stacking order. Hidden layers, guides and selection marks are excluded.</p><div className="export-buttons"><button disabled={exporting} onClick={() => download('png')}>Export PNG</button><button className="primary" disabled={exporting} onClick={() => download('svg')}><Icon name="download" size={16} />{exporting ? 'Preparing…' : 'Export SVG'}</button></div></div></div>}
  </div>
}
export default App
