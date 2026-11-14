import { useEffect, useReducer, useState } from 'react'
import { addShape, exportSVG, initialDocument, initialShape, instances, latticeSteps, matrixText, migrateDocument, pathData, removeShape, shapeCenter, translateShape, updateShape } from './core/geometry'
import type { PatternDocument, Point, RepeatMode, Shape } from './core/geometry'
import { history, reducer } from './core/history'
import { Canvas, MotifPaths } from './components/Canvas'
import type { Tool, View } from './components/Canvas'
import { Icon, Panel, Range } from './components/controls'
import './App.css'

const storageKey = 'tesselate-gpt.document.v2'
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const palettes = [['#62794c', '#f4f2e9'], ['#b45e47', '#f6e8d7'], ['#415c80', '#edf1f2'], ['#ae7844', '#f4eddb'], ['#825c81', '#f2e8ee'], ['#e5c77a', '#293e37']]
const presets: { name: string; points: Point[]; smooth: number }[] = [
  { name: 'Botanical', points: initialShape.points, smooth: 0.8 },
  { name: 'Petal', points: [{ x: 0, y: -85 }, { x: 57, y: -25 }, { x: 40, y: 47 }, { x: 0, y: 80 }, { x: -40, y: 47 }, { x: -57, y: -25 }], smooth: 1 },
  { name: 'Rectangle', points: [{ x: -65, y: -65 }, { x: 65, y: -65 }, { x: 65, y: 65 }, { x: -65, y: 65 }], smooth: 0 },
  { name: 'Circle', points: Array.from({ length: 12 }, (_, i) => ({ x: Math.cos(i * Math.PI / 6) * 70, y: Math.sin(i * Math.PI / 6) * 70 })), smooth: 1 },
  { name: 'Kite', points: [{ x: 0, y: -85 }, { x: 70, y: 0 }, { x: 0, y: 85 }, { x: -35, y: 0 }], smooth: 0 },
  { name: 'Ribbon', points: [{ x: -80, y: -55 }, { x: 0, y: -25 }, { x: 80, y: -55 }, { x: 80, y: 55 }, { x: 0, y: 25 }, { x: -80, y: 55 }], smooth: 0.7 },
]
const wedge: Point[] = [{ x: 0, y: -120 }, { x: 17, y: -94 }, { x: 11, y: -82 }, { x: 32, y: -86 }, { x: 40, y: -69 }, { x: 17, y: -49 }, { x: 23, y: -40 }, { x: 0, y: 0 }, { x: 0, y: -35 }, { x: 9, y: -50 }, { x: 0, y: -63 }]
function loadDocument(): PatternDocument {
  try {
    const current = migrateDocument(JSON.parse(localStorage.getItem(storageKey) ?? 'null'))
    const legacy = current ? null : migrateDocument(JSON.parse(localStorage.getItem('tesselate-gpt.document.v1') ?? 'null'))
    return current ?? legacy ?? initialDocument
  } catch { return initialDocument }
}
function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => history(loadDocument()))
  const doc = state.present
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(() => doc.shapes.at(-1)?.id ?? null)
  const [selected, setSelected] = useState<number | null>(null)
  const active = doc.shapes.find(s => s.id === selectedId)
  const [draft, setDraft] = useState<Point[]>([])
  const [split, setSplit] = useState(false)
  const [guides, setGuides] = useState(true)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [panels, setPanels] = useState<Record<string, boolean>>({ tools: true, library: true, layers: true, geometry: true, contour: true, appearance: true })
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
  const change = <K extends keyof PatternDocument>(key: K, value: PatternDocument[K]) => dispatch({ type: state.gesture ? 'live' : 'edit', update: d => ({ ...d, [key]: value }) })
  const changeShape = <K extends keyof Shape>(key: K, value: Shape[K]) => { if (active) dispatch({ type: state.gesture ? 'live' : 'edit', update: d => updateShape(d, active.id, shape => ({ ...shape, [key]: value })) }) }
  const selectShape = (id: string | null, node: number | null = null) => { setSelectedId(id); setSelected(node) }
  const panelProps = (id: string) => ({ id, open: panels[id], onOpenChange: (open: boolean) => setPanels(p => ({ ...p, [id]: open })) })
  function openDock(side: 'left' | 'right', section: string) {
    if (side === 'left') setLeftCollapsed(false); else setRightCollapsed(false)
    setPanels(p => ({ ...p, [section]: true }))
    requestAnimationFrame(() => document.querySelector(`[data-panel-id="${section}"]`)?.scrollIntoView({ block: 'nearest' }))
  }
  function activateTool(next: Tool) { setTool(next); setDraft([]); setSelected(null) }
  function insert(shape: Shape) {
    if (doc.shapes.length >= 64) return
    dispatch({ type: 'edit', update: d => addShape(d, shape) }); setDraft([]); selectShape(shape.id); setTool('select'); setPanels(p => ({ ...p, layers: true }))
  }
  function addPreset(index: number) {
    const preset = presets[index], count = doc.shapes.length, scale = count ? 0.65 : 1
    insert({ ...initialShape, id: crypto.randomUUID(), name: `${preset.name} ${count + 1}`, points: preset.points.map(p => ({ x: p.x * scale + (count ? 55 + (count % 3) * 12 : 0), y: p.y * scale + (count ? 25 : 0) })), smooth: preset.smooth, fill: palettes[count % palettes.length][0] })
  }
  function duplicateShape() {
    if (!active || doc.shapes.length >= 64) return
    insert(translateShape({ ...active, id: crypto.randomUUID(), name: `${active.name} copy`.slice(0, 80) }, { x: 20, y: 20 }))
  }
  function deleteShape() {
    if (!active) return
    dispatch({ type: 'edit', update: d => removeShape(d, active.id) }); setSelectedId(null); setSelected(null)
  }
  function reorderShape(direction: number) {
    if (!active) return
    dispatch({ type: 'edit', update: d => {
      const shapes = [...d.shapes], from = shapes.findIndex(s => s.id === active.id), to = clamp(from + direction, 0, shapes.length - 1)
      shapes.splice(to, 0, ...shapes.splice(from, 1)); return { ...d, shapes }
    } })
  }
  function finishDraft() {
    if (draft.length < 3 || doc.shapes.length >= 64) return
    const shape = { ...initialShape, id: crypto.randomUUID(), name: `Drawn shape ${doc.shapes.length + 1}`, points: draft, smooth: 0, fill: palettes[doc.shapes.length % palettes.length][0] }
    insert(shape); setTool('nodes'); setSelected(0)
  }
  function addNode() {
    if (!active || active.points.length >= 300) return
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
      if (event.key === 'Escape') { dispatch({ type: 'cancel' }); setDraft([]); setExportOpen(false); return }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (draft.length && !event.shiftKey) setDraft(d => d.slice(0, -1)); else { setDraft([]); setSelected(null); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }) } return }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && !exportOpen) { event.preventDefault(); duplicateShape(); return }
      if (event.metaKey || event.ctrlKey || event.altKey || exportOpen) return
      if (event.key === 'v') activateTool('select')
      if (event.key === 'a') activateTool('nodes')
      if (event.key === 'p') { if (doc.shapes.length < 64) activateTool('pen') }
      if (event.key === 'h') activateTool('hand')
      if (event.key === 'Enter' && draft.length >= 3) finishDraft()
      if (active && !draft.length) {
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault()
          if (selected !== null && tool === 'nodes') { if (active.points.length > 3) { changeShape('points', active.points.filter((_, i) => i !== selected)); setSelected(null) } }
          else deleteShape()
        }
        const arrows: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
        const delta = arrows[event.key]
        if (delta) {
          event.preventDefault(); const step = event.shiftKey ? 10 : 1
          dispatch({ type: 'edit', update: d => updateShape(d, active.id, shape => selected !== null && tool === 'nodes' ? { ...shape, points: shape.points.map((p, i) => i === selected ? { x: clamp(p.x + delta.x * step, -2000, 2000), y: clamp(p.y + delta.y * step, -2000, 2000) } : p) } : translateShape(shape, { x: delta.x * step, y: delta.y * step })) })
        }
      }
    }
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle)
  })
  const liveDoc = draft.length >= 2 ? { ...doc, shapes: [...doc.shapes, { ...initialShape, id: 'draft', name: 'Draft', points: draft, smooth: 0, fill: palettes[doc.shapes.length % palettes.length][0] }] } : doc
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
  const selectedPoint = active && selected !== null && tool === 'nodes' ? active.points[selected] : undefined
  const position = selectedPoint ?? (active ? shapeCenter(active) : { x: 0, y: 0 })
  const activeIndex = doc.shapes.findIndex(s => s.id === active?.id)
  const modes: [RepeatMode, string, string][] = [['grid', 'Grid', 'square'], ['brick', 'Half-drop', 'brick'], ['hex', 'Hexagon', 'hex'], ['radial', 'Radial', 'radial']]
  return <div className="app-shell">
    <header className="app-header">
      <div className="brand"><span className="brand-mark">✳</span>tesselate<span className="alpha">ALPHA</span></div>
      <div className="document-name">Untitled pattern<span className={storageError ? 'save-status error' : 'save-status'}>{storageError ? 'Local save unavailable' : draft.length ? 'Drawing another shape…' : saved ? 'Saved on this device' : 'Saving…'}</span></div>
      <div className="header-actions"><span className="local-badge">{doc.shapes.length} SHAPE{doc.shapes.length === 1 ? '' : 'S'} · ONE MOTIF</span><button className="primary" disabled={draft.length > 0} title={draft.length ? 'Finish the contour before exporting' : 'Export pattern'} onClick={() => setExportOpen(true)}><Icon name="download" size={16} />Export pattern</button></div>
    </header>
    <div className="workspace">
      <aside className={`left-panel ${leftCollapsed ? 'dock-collapsed' : ''}`} aria-label="Workspace panels">
        <div className="dock-header"><span>WORKSPACE</span><button className="icon-button" aria-label={leftCollapsed ? 'Expand workspace' : 'Collapse workspace'} aria-expanded={!leftCollapsed} title={leftCollapsed ? 'Expand workspace' : 'Collapse workspace'} onClick={() => setLeftCollapsed(!leftCollapsed)}><Icon name="left" size={16} /></button></div>
        {leftCollapsed ? <div className="dock-rail">{(['select', 'nodes', 'pen', 'hand'] as Tool[]).map(t => <button key={t} className={`icon-button ${tool === t ? 'selected' : ''}`} aria-label={`Use ${t} tool`} title={`${t} tool`} disabled={t === 'pen' && doc.shapes.length >= 64} onClick={() => activateTool(t)}><Icon name={t} size={17} /></button>)}<span className="rail-divider" /><button className="icon-button" aria-label="Open add shapes" title="Add shapes" onClick={() => openDock('left', 'library')}><Icon name="shapes" size={18} /></button><button className="icon-button" aria-label="Open layers" title="Layers" onClick={() => openDock('left', 'layers')}><Icon name="layers" size={18} /></button></div> : <div className="dock-scroll">
          <Panel {...panelProps('tools')} title="Tools" icon="select"><div className="tools">{(['select', 'nodes', 'pen', 'hand'] as Tool[]).map((t, i) => <button key={t} className={tool === t ? 'tool active' : 'tool'} title={`${['Move shapes', 'Edit nodes', 'Draw another shape', 'Pan canvas'][i]} (${['V', 'A', 'P', 'H'][i]})`} aria-label={['Move shapes', 'Edit nodes', 'Draw polygon', 'Pan canvas'][i]} disabled={t === 'pen' && doc.shapes.length >= 64} aria-pressed={tool === t} onClick={() => activateTool(t)}><Icon name={t} size={17} /><span>{['Move', 'Nodes', 'Draw', 'Pan'][i]}</span></button>)}</div></Panel>
          <Panel {...panelProps('library')} title="Add shapes" icon="shapes"><p className="panel-hint">Click to add to the motif.</p><div className="presets">{presets.map((p, i) => <button key={p.name} onClick={() => addPreset(i)} disabled={doc.shapes.length >= 64} title={`Add ${p.name}`} aria-label={`Add ${p.name}`}><svg viewBox="-110 -110 220 220" aria-hidden="true"><path d={pathData(p.points, p.smooth)} /></svg><span>{p.name}</span><span className="preset-plus"><Icon name="plus" size={10} /></span></button>)}</div></Panel>
          <Panel {...panelProps('layers')} title="Layers" icon="layers"><div className="layers-toolbar"><span>{doc.shapes.length} / 64 shapes</span><div><button className="icon-button" disabled={!active || doc.shapes.length >= 64} title="Duplicate shape (⌘/Ctrl D)" aria-label="Duplicate selected shape" onClick={duplicateShape}><Icon name="copy" size={14} /></button><button className="icon-button" disabled={!active} title="Delete shape" aria-label="Delete selected shape" onClick={deleteShape}><Icon name="trash" size={14} /></button></div></div>
            <div className="layer-list">{[...doc.shapes].reverse().map(shape => <div key={shape.id} className={`layer-row ${active?.id === shape.id ? 'active' : ''} ${shape.visible ? '' : 'is-hidden'}`}><button className="layer-select" aria-label={`Select layer ${shape.name}`} aria-pressed={active?.id === shape.id} onClick={() => { selectShape(shape.id); activateTool('select') }}><svg viewBox="-120 -120 240 240" aria-hidden="true"><path d={pathData(shape.points.map(p => { const c = shapeCenter(shape); return { x: p.x - c.x, y: p.y - c.y } }), shape.smooth)} fill={shape.fill} /></svg><span>{shape.name}<small>{shape.points.length} nodes</small></span></button><button className="icon-button layer-eye" aria-label={`${shape.visible ? 'Hide' : 'Show'} ${shape.name}`} aria-pressed={shape.visible} title={shape.visible ? 'Hide shape' : 'Show shape'} onClick={() => dispatch({ type: 'edit', update: d => updateShape(d, shape.id, s => ({ ...s, visible: !s.visible })) })}><Icon name={shape.visible ? 'eye' : 'hidden'} size={14} /></button></div>)}</div>
            {!doc.shapes.length && <p className="field-note">Add a shape above or use the pen to start drawing.</p>}
            <div className="guide-layer"><button className="layer-select" onClick={() => openDock('right', 'geometry')}><Icon name={modes.find(m => m[0] === doc.repeat)?.[2] ?? 'grid'} size={15} /><span>Geometry guides<small>{modes.find(m => m[0] === doc.repeat)?.[1]} cell</small></span></button><button className="icon-button" aria-label="Toggle geometry guide layer" aria-pressed={guides} title={guides ? 'Hide geometry guides' : 'Show geometry guides'} onClick={() => setGuides(!guides)}><Icon name={guides ? 'eye' : 'hidden'} size={14} /></button></div>
          </Panel>
        </div>}
      </aside>
      <main className="studio">
        <div className="canvas-toolbar"><div className="history-actions"><button className="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl Z)" disabled={!state.past.length && !state.gesture && !draft.length} onClick={undo}><Icon name="undo" /></button><button className="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)" disabled={!state.future.length} onClick={redo}><Icon name="redo" /></button><span className="toolbar-divider" /><span className="canvas-title">{split ? 'Composition & pattern' : 'Composition'}</span></div><div className="canvas-actions"><button className={`icon-button ${guides ? 'selected' : ''}`} title="Toggle guides" aria-label="Toggle guides" aria-pressed={guides} onClick={() => setGuides(!guides)}><Icon name={modes.find(m => m[0] === doc.repeat)?.[2] ?? 'grid'} size={16} /></button><button className={`split-button ${split ? 'selected' : ''}`} aria-pressed={split} onClick={() => setSplit(!split)}><Icon name="split" size={16} /><span>Split preview</span></button></div></div>
        <div className={`canvases ${split ? 'is-split' : ''}`}>
          <Canvas doc={liveDoc} view={view} setView={setView} focus guides={guides} tool={tool} activeId={active?.id ?? null} selected={selected} onSelect={selectShape} onEditNodes={() => setTool('nodes')} draft={draft} onDraftPoint={p => setDraft(prev => [...prev, p].slice(0, 300))} finishDraft={finishDraft} dispatch={dispatch} />
          {split && <Canvas doc={liveDoc} view={previewView} setView={setPreviewView} focus={false} guides={false} tool="hand" activeId={null} selected={null} onSelect={() => {}} onEditNodes={() => {}} draft={[]} onDraftPoint={() => {}} finishDraft={() => {}} dispatch={dispatch} />}
        </div>
        <div className="canvas-status"><span><span className="green-dot" />{doc.shapes.filter(s => s.visible).length} visible shapes</span><span>{draft.length ? `${draft.length} points · Enter to close · Esc to cancel` : tool === 'hand' ? 'Drag to pan · Scroll to zoom' : tool === 'pen' ? 'Draw another contour · Existing shapes stay in place' : tool === 'nodes' ? 'Drag nodes · Arrow keys to nudge · Shift for 10×' : 'Drag shapes · Double-click for nodes · ⌘/Ctrl D to duplicate'}</span><span>{doc.repeat === 'radial' ? `${doc.sectors} sectors` : 'Live repetition'}</span></div>
      </main>
      <aside className={`right-panel ${rightCollapsed ? 'dock-collapsed' : ''}`} aria-label="Inspector panels">
        <div className="dock-header"><span>INSPECTOR</span><button className="icon-button" aria-label={rightCollapsed ? 'Expand inspector' : 'Collapse inspector'} aria-expanded={!rightCollapsed} title={rightCollapsed ? 'Expand inspector' : 'Collapse inspector'} onClick={() => setRightCollapsed(!rightCollapsed)}><Icon name="right" size={16} /></button></div>
        {rightCollapsed ? <div className="dock-rail">{[['geometry', 'hex', 'Repeat geometry'], ['contour', 'nodes', 'Shape properties'], ['appearance', 'palette', 'Appearance']].map(([key, icon, label]) => <button key={key} className="icon-button" aria-label={`Open ${label}`} title={label} onClick={() => openDock('right', key)}><Icon name={icon} size={18} /></button>)}</div> : <div className="dock-scroll">
          <Panel {...panelProps('geometry')} title="Repeat geometry" icon="hex"><div className="repeat-modes">{modes.map(([mode, label, icon]) => <button key={mode} className={doc.repeat === mode ? 'active' : ''} aria-pressed={doc.repeat === mode} onClick={() => change('repeat', mode)}><Icon name={icon} size={16} />{label}</button>)}</div>
            {doc.repeat === 'radial' ? <><Range label="Sectors" value={doc.sectors} min={2} max={24} onChange={n => change('sectors', n)} begin={begin} end={end} /><p className="field-note">The sector guide follows the repetition angle and mirror setting.</p><button className="text-button wedge-button" disabled={doc.shapes.length >= 64} onClick={() => { const shape = { ...initialShape, id: crypto.randomUUID(), name: `Snowflake ${doc.shapes.length + 1}`, points: wedge, smooth: 0 }; dispatch({ type: 'edit', update: d => ({ ...addShape(d, shape), repeat: 'radial', sectors: 12, mirror: true, angle: 0 }) }); selectShape(shape.id, 0); setDraft([]); setTool('nodes') }}>↗ Add a snowflake wedge</button></> : <><Range label={doc.repeat === 'hex' ? 'Hexagon width' : 'Horizontal spacing'} value={doc.spacingX} min={60} max={400} unit=" px" onChange={n => change('spacingX', n)} begin={begin} end={end} />{doc.repeat === 'hex' ? <p className="field-note">Regular hexagons · row spacing {latticeSteps(doc).y.toFixed(1)} px. The outlines show the actual repeat cells.</p> : <Range label="Vertical spacing" value={doc.spacingY} min={60} max={400} unit=" px" onChange={n => change('spacingY', n)} begin={begin} end={end} />}</>}
            <Range label="Motif rotation" value={doc.angle} min={-180} max={180} unit="°" onChange={n => change('angle', n)} begin={begin} end={end} /><label className="check-row"><span>Reflect alternate copies</span><input type="checkbox" checked={doc.mirror} onChange={e => change('mirror', e.target.checked)} /></label><label className="check-row"><span>Show geometry guides</span><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} /></label>
          </Panel>
          <Panel {...panelProps('contour')} title="Shape properties" icon="nodes">{active ? <><label className="shape-name-field">Layer name<input aria-label="Shape name" maxLength={80} value={active.name} onChange={e => changeShape('name', e.target.value)} /></label><div className="shape-actions"><button className="secondary" onClick={() => { setTool(tool === 'nodes' ? 'select' : 'nodes'); setSelected(null); setDraft([]) }}><Icon name={tool === 'nodes' ? 'select' : 'nodes'} size={13} />{tool === 'nodes' ? 'Move shape' : 'Edit nodes'}</button><button className="icon-button" disabled={activeIndex === doc.shapes.length - 1} title="Bring forward" aria-label="Bring shape forward" onClick={() => reorderShape(1)}><Icon name="up" size={15} /></button><button className="icon-button" disabled={activeIndex === 0} title="Send backward" aria-label="Send shape backward" onClick={() => reorderShape(-1)}><Icon name="down" size={15} /></button></div><div className="node-heading">{selectedPoint ? `Node ${selected! + 1}` : 'Shape position'}{selectedPoint && <button className="text-button" disabled={active.points.length <= 3} onClick={() => { changeShape('points', active.points.filter((_, i) => i !== selected)); setSelected(null) }}>Remove node</button>}</div><div className="coordinate-inputs">{(['x', 'y'] as const).map(axis => <label key={axis}><span>{axis.toUpperCase()}</span><input aria-label={`${selectedPoint ? 'Node' : 'Shape'} ${axis.toUpperCase()}`} type="number" min={-2000} max={2000} step={1} value={Number(position[axis].toFixed(2))} onChange={e => {
              if (!e.target.value || !Number.isFinite(e.target.valueAsNumber)) return
              const n = clamp(e.target.valueAsNumber, -2000, 2000)
              dispatch({ type: 'edit', update: d => updateShape(d, active.id, shape => selectedPoint ? { ...shape, points: shape.points.map((p, i) => i === selected ? { ...p, [axis]: n } : p) } : translateShape(shape, { x: axis === 'x' ? n - shapeCenter(shape).x : 0, y: axis === 'y' ? n - shapeCenter(shape).y : 0 })) })
            }} /></label>)}</div><Range label="Curve softness" value={active.smooth} min={0} max={1} step={0.05} onChange={n => changeShape('smooth', n)} begin={begin} end={end} /><button className="text-button add-node" onClick={addNode} disabled={draft.length > 0 || active.points.length >= 300}><Icon name="plus" size={13} />Add node after selection</button></> : <p className="field-note">Select a shape on the canvas or in Layers to edit it.</p>}
            {draft.length > 0 && <button className="primary finish-button" disabled={draft.length < 3} onClick={finishDraft}>Finish contour ({draft.length} points)</button>}
          </Panel>
          <Panel {...panelProps('appearance')} title="Appearance" icon="palette"><div className="color-row"><label><input type="color" aria-label="Selected shape color" value={active?.fill ?? initialShape.fill} disabled={!active} onChange={e => changeShape('fill', e.target.value)} /><span>Selected shape<small>{active ? active.fill.toUpperCase() : 'No selection'}</small></span></label><label><input type="color" aria-label="Background color" value={doc.background} onChange={e => change('background', e.target.value)} /><span>Canvas<small>{doc.background.toUpperCase()}</small></span></label></div><Range label="Outline width" value={active?.strokeWidth ?? 0} min={0} max={8} step={0.5} unit=" px" disabled={!active} onChange={n => changeShape('strokeWidth', n)} begin={begin} end={end} />{active && active.strokeWidth > 0 && <label className="stroke-color">Outline color<input type="color" aria-label="Outline color" value={active.stroke} onChange={e => changeShape('stroke', e.target.value)} /></label>}<p className="palette-label">Palettes for selected shape + canvas</p><div className="palettes">{palettes.map(([fill, background], i) => <button key={fill} style={{ background }} title={`Apply palette ${i + 1}`} aria-label={`Apply palette ${i + 1}`} onClick={() => dispatch({ type: 'edit', update: d => ({ ...(active ? updateShape(d, active.id, s => ({ ...s, fill })) : d), background }) })}><span style={{ background: fill }} /></button>)}</div></Panel>
          <div className="geometry-note"><span>ONE MOTIF, MANY SHAPES</span><p>Every visible layer repeats together. Guides show the geometry; free shapes can still overlap or leave gaps.</p></div>
        </div>}
      </aside>
    </div>
    {message && <div className="toast" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><Icon name="close" size={14} /></button></div>}
    {exportOpen && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setExportOpen(false) }}><div className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title" onKeyDown={e => { if (e.key === 'Escape') setExportOpen(false); if (e.key === 'Tab') { const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input')); const first = els[0], last = els.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() } } }}><div className="modal-heading"><div><p className="eyebrow">FROM EXPLORATION TO ARTWORK</p><h2 id="export-title">Export your pattern</h2></div><button className="icon-button" aria-label="Close export" autoFocus onClick={() => setExportOpen(false)}><Icon name="close" /></button></div><div className="export-thumbnail" style={{ background: doc.background }}><svg viewBox="-260 -100 520 200"><defs><g id="export-thumb-motif"><MotifPaths doc={doc} /></g></defs>{instances(doc, { x: -260, y: -100, width: 520, height: 200 }).map(c => <use key={c.id} href="#export-thumb-motif" transform={matrixText(c.matrix)} />)}</svg></div><div className="export-dimensions"><label>Width, px<input aria-label="Export width" type="number" min={1} max={16000} value={width} onChange={e => setWidth(e.target.valueAsNumber || 0)} /></label><span>×</span><label>Height, px<input aria-label="Export height" type="number" min={1} max={16000} value={height} onChange={e => setHeight(e.target.valueAsNumber || 0)} /></label></div><label className="export-scale">Pattern scale<span><input aria-label="Export pattern scale" type="number" min={25} max={400} value={exportScale} onChange={e => setExportScale(e.target.valueAsNumber || 0)} />%</span></label><p className="field-note">Exports every visible shape in stacking order. Hidden layers, guides and selection marks are excluded.</p><div className="export-buttons"><button disabled={exporting} onClick={() => download('png')}>Export PNG</button><button className="primary" disabled={exporting} onClick={() => download('svg')}><Icon name="download" size={16} />{exporting ? 'Preparing…' : 'Export SVG'}</button></div></div></div>}
  </div>
}
export default App
