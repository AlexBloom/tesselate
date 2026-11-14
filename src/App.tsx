import { useEffect, useId, useReducer, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { exportSVG, initialDocument, instances, inversePoint, matrixText, pathData, rotation, validDocument } from './core/geometry'
import type { PatternDocument, Point, RepeatMode } from './core/geometry'
import { history, reducer } from './core/history'
import './App.css'

type Tool = 'nodes' | 'pen' | 'hand'
type View = { x: number; y: number; zoom: number }
const storageKey = 'tesselate-gpt.document.v1'
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const palettes = [ ['#62794c', '#f4f2e9'], ['#b45e47', '#f6e8d7'], ['#415c80', '#edf1f2'], ['#ae7844', '#f4eddb'], ['#825c81', '#f2e8ee'], ['#e5c77a', '#293e37'] ]
const presets: { name: string; points: Point[]; smooth: number }[] = [
  { name: 'Botanical', points: initialDocument.points, smooth: 0.8 },
  { name: 'Petal', points: [{ x: 0, y: -85 }, { x: 57, y: -25 }, { x: 40, y: 47 }, { x: 0, y: 80 }, { x: -40, y: 47 }, { x: -57, y: -25 }], smooth: 1 },
  { name: 'Kite', points: [{ x: 0, y: -85 }, { x: 70, y: 0 }, { x: 0, y: 85 }, { x: -35, y: 0 }], smooth: 0 },
  { name: 'Ribbon', points: [{ x: -80, y: -55 }, { x: 0, y: -25 }, { x: 80, y: -55 }, { x: 80, y: 55 }, { x: 0, y: 25 }, { x: -80, y: 55 }], smooth: 0.7 },
]
function loadDocument(): PatternDocument {
  try { const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null'); return validDocument(saved) ? saved : initialDocument } catch { return initialDocument }
}
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    nodes: 'M5 3l14 9-7 1-3 7z', pen: 'M4 20l3-8L17 2l5 5-10 10zM7 12l5 5M4 20l6-2',
    hand: 'M8 12V5a2 2 0 014 0v6-8a2 2 0 014 0v8-6a2 2 0 014 0v11c0 4-3 6-7 6-3 0-5-1-7-4L3 13a2 2 0 013-2l2 3',
    undo: 'M9 4L4 9l5 5M4 9h10a6 6 0 010 12', redo: 'M15 4l5 5-5 5m5-5H10a6 6 0 000 12',
    split: 'M3 4h18v16H3zM12 4v16', download: 'M12 3v12m-5-5l5 5 5-5M4 16v5h16v-5', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
    grid: 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18', close: 'M5 5l14 14M19 5L5 19', fit: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.nodes} /></svg>
}
function Range({ label, value, min, max, step = 1, unit = '', onChange, begin, end }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void; begin: () => void; end: () => void }) {
  return <label className="range-label"><span>{label}<output>{Math.round(value * 100) / 100}{unit}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onKeyDown={begin} onKeyUp={end} onBlur={end} onChange={e => onChange(Number(e.target.value))} /></label>
}
function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => history(loadDocument()))
  const doc = state.present
  const [tool, setTool] = useState<Tool>('nodes')
  const [selected, setSelected] = useState<number | null>(0)
  const [draft, setDraft] = useState<Point[]>([])
  const [split, setSplit] = useState(false)
  const [guides, setGuides] = useState(true)
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
  const finishDraft = () => {
    if (draft.length < 3) return
    dispatch({ type: 'edit', update: d => ({ ...d, points: draft, smooth: 0 }) })
    setDraft([]); setSelected(0); setTool('nodes')
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
  useEffect(() => {
    if (!message) return
    const timeout = setTimeout(() => setMessage(''), 5000)
    return () => clearTimeout(timeout)
  }, [message])
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, select, textarea')) return
      if (event.key === 'Escape') { dispatch({ type: 'cancel' }); setDraft([]); setExportOpen(false); return }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (draft.length && !event.shiftKey) { setDraft(d => d.slice(0, -1)); return } setDraft([]); setSelected(null); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }); return }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); dispatch({ type: 'redo' }); return }
      if (event.metaKey || event.ctrlKey || event.altKey || exportOpen) return
      if (event.key === 'v') { setTool('nodes'); setDraft([]) }
      if (event.key === 'p') { setTool('pen'); setDraft([]); setSelected(null) }
      if (event.key === 'h') { setTool('hand'); setDraft([]) }
      if (event.key === 'Enter' && draft.length >= 3) finishDraft()
      if (selected !== null && !draft.length) {
        if ((event.key === 'Backspace' || event.key === 'Delete') && doc.points.length > 3) {
          event.preventDefault(); dispatch({ type: 'edit', update: d => ({ ...d, points: d.points.filter((_, i) => i !== selected) }) }); setSelected(null)
        }
        const arrows: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
        const delta = arrows[event.key]
        if (delta) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; dispatch({ type: 'edit', update: d => ({ ...d, points: d.points.map((p, i) => i === selected ? { x: clamp(p.x + delta.x * step, -500, 500), y: clamp(p.y + delta.y * step, -500, 500) } : p) }) }) }
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  })
  function preset(index: number) {
    setDraft([]); setSelected(0); setTool('nodes')
    dispatch({ type: 'edit', update: d => ({ ...d, points: presets[index].points.map(p => ({ ...p })), smooth: presets[index].smooth }) })
  }
  function addNode() {
    if (doc.points.length >= 300) return
    const i = selected ?? 0, a = doc.points[i], b = doc.points[(i + 1) % doc.points.length]
    const points = [...doc.points]; points.splice(i + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    dispatch({ type: 'edit', update: d => ({ ...d, points }) }); setSelected(i + 1)
  }
  const liveDoc = draft.length >= 2 ? { ...doc, points: draft, smooth: 0 } : doc
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
  const selectedPoint = selected === null ? undefined : doc.points[selected]
  return <div className="app-shell">
    <header className="app-header">
      <div className="brand"><span className="brand-mark">✳</span>tesselate<span className="alpha">ALPHA</span></div>
      <div className="document-name">Untitled pattern<span className={storageError ? 'save-status error' : 'save-status'}>{storageError ? 'Local save unavailable' : draft.length ? 'Drawing contour…' : saved ? 'Saved on this device' : 'Saving…'}</span></div>
      <div className="header-actions"><span className="local-badge">LOCAL STUDIO</span><button className="primary" disabled={draft.length > 0} title={draft.length ? 'Finish the contour before exporting' : 'Export pattern'} onClick={() => setExportOpen(true)}><Icon name="download" size={16} />Export pattern</button></div>
    </header>
    <div className="workspace">
      <aside className="left-panel">
        <div className="panel-title">WORKSPACE<span>01</span></div>
        <section><h2>Drawing tools</h2><div className="tools">{(['nodes', 'pen', 'hand'] as Tool[]).map((t, i) => <button key={t} className={tool === t ? 'tool active' : 'tool'} title={`${['Edit nodes', 'Draw polygon', 'Pan canvas'][i]} (${['V', 'P', 'H'][i]})`} aria-label={['Edit nodes', 'Draw polygon', 'Pan canvas'][i]} aria-pressed={tool === t} onClick={() => { setTool(t); setDraft([]); if (t === 'pen') setSelected(null) }}><Icon name={t} /><span>{['Edit', 'Draw', 'Pan'][i]}</span></button>)}</div></section>
        <section><div className="section-heading"><h2>Starting shapes</h2><span>04</span></div><div className="presets">{presets.map((p, i) => <button key={p.name} onClick={() => preset(i)} title={`Use ${p.name} shape`}><svg viewBox="-110 -110 220 220" aria-hidden="true"><path d={pathData(p.points, p.smooth)} /></svg><span>{p.name}</span></button>)}</div></section>
        <section className="motif-section"><h2>Source motif</h2><div className="motif-item"><span className="layer-icon">◇</span><div>Motif 01<small>{doc.points.length} editable nodes</small></div><span className="layer-dot" /></div><button className="text-button" onClick={addNode} disabled={draft.length > 0 || doc.points.length >= 300}><Icon name="plus" size={14} />Add node after selection</button></section>
        <div className="canvas-note"><span className="note-symbol">↗</span><h3>Small changes.<br />A whole new rhythm.</h3><p>Edit the solid shape. Every surrounding copy follows.</p><span className="note-tag">NO AI REQUIRED</span></div>
        <div className="left-bottom"><span className="green-dot" />Everything runs on your device</div>
      </aside>
      <main className="studio">
        <div className="canvas-toolbar"><div className="history-actions"><button className="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl Z)" disabled={!state.past.length && !state.gesture && !draft.length} onClick={undo}><Icon name="undo" /></button><button className="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)" disabled={!state.future.length} onClick={redo}><Icon name="redo" /></button><span className="toolbar-divider" /><span className="canvas-title">{split ? 'Motif & pattern' : 'Motif canvas'}</span></div><div className="canvas-actions"><button className={`icon-button ${guides ? 'selected' : ''}`} title="Toggle guides" aria-label="Toggle guides" aria-pressed={guides} onClick={() => setGuides(!guides)}><Icon name="grid" size={16} /></button><button className={`split-button ${split ? 'selected' : ''}`} aria-pressed={split} onClick={() => setSplit(!split)}><Icon name="split" size={16} /><span>Split preview</span></button></div></div>
        <div className={`canvases ${split ? 'is-split' : ''}`}>
          <Canvas doc={liveDoc} view={view} setView={setView} focus guides={guides} tool={tool} selected={selected} setSelected={setSelected} draft={draft} onDraftPoint={p => setDraft(prev => [...prev, p].slice(0, 300))} finishDraft={finishDraft} dispatch={dispatch} />
          {split && <Canvas doc={liveDoc} view={previewView} setView={setPreviewView} focus={false} guides={false} tool="hand" selected={null} setSelected={() => {}} draft={[]} onDraftPoint={() => {}} finishDraft={() => {}} dispatch={dispatch} />}
        </div>
        <div className="canvas-status"><span><span className="green-dot" />Live repetition</span><span>{draft.length ? `${draft.length} points · Click first point or press Enter to close · Esc cancels` : tool === 'hand' ? 'Drag to pan · Scroll to zoom' : tool === 'pen' ? 'Click to place points · Close your contour to finish' : 'Drag nodes · Arrow keys to nudge · Shift for 10×'}</span><span>{doc.repeat === 'radial' ? `${doc.sectors} sectors` : 'Infinite repeat'}</span></div>
      </main>
      <aside className="right-panel"><div className="panel-title">PATTERN PROPERTIES<span>↗</span></div>
        <section><h2>Repeat geometry</h2><div className="repeat-modes">{([['grid', 'Grid', '▦'], ['brick', 'Half-drop', '▤'], ['hex', 'Hex lattice', '⬡'], ['radial', 'Radial', '✳']] as [RepeatMode, string, string][]).map(([mode, label, symbol]) => <button key={mode} className={doc.repeat === mode ? 'active' : ''} aria-pressed={doc.repeat === mode} onClick={() => change('repeat', mode)}><span>{symbol}</span>{label}</button>)}</div>
          {doc.repeat !== 'radial' ? <><Range label="Horizontal spacing" value={doc.spacingX} min={60} max={400} unit=" px" onChange={n => change('spacingX', n)} begin={begin} end={end} /><Range label="Vertical spacing" value={doc.spacingY} min={60} max={400} unit=" px" onChange={n => change('spacingY', n)} begin={begin} end={end} /></> : <><Range label="Sectors" value={doc.sectors} min={2} max={24} onChange={n => change('sectors', n)} begin={begin} end={end} /><p className="field-note">Copies share a center. Draw a narrow wedge motif to explore snowflake symmetry.</p><button className="text-button wedge-button" onClick={() => { setDraft([]); setSelected(0); setTool('nodes'); dispatch({ type: 'edit', update: d => ({ ...d, sectors: 12, mirror: true, smooth: 0, angle: 0, points: [{ x: 0, y: -120 }, { x: 17, y: -94 }, { x: 11, y: -82 }, { x: 32, y: -86 }, { x: 40, y: -69 }, { x: 17, y: -49 }, { x: 23, y: -40 }, { x: 0, y: 0 }, { x: 0, y: -35 }, { x: 9, y: -50 }, { x: 0, y: -63 }] }) }) }}>↗ Start a snowflake wedge</button></>}
          <Range label="Rotation" value={doc.angle} min={-180} max={180} unit="°" onChange={n => change('angle', n)} begin={begin} end={end} />
          <label className="check-row"><span>Reflect alternate copies</span><input type="checkbox" checked={doc.mirror} onChange={e => change('mirror', e.target.checked)} /></label>
        </section>
        <section><h2>Contour</h2><Range label="Curve softness" value={doc.smooth} min={0} max={1} step={0.05} onChange={n => change('smooth', n)} begin={begin} end={end} />
          {selectedPoint && !draft.length ? <><div className="node-heading">Node {selected! + 1}<button className="text-button" disabled={doc.points.length <= 3} onClick={() => { dispatch({ type: 'edit', update: d => ({ ...d, points: d.points.filter((_, i) => i !== selected) }) }); setSelected(null) }}>Remove</button></div><div className="coordinate-inputs">{(['x', 'y'] as const).map(axis => <label key={axis}><span>{axis.toUpperCase()}</span><input aria-label={`Node ${axis.toUpperCase()}`} type="number" min={-500} max={500} step={1} value={Number(selectedPoint[axis].toFixed(2))} onChange={e => { if (!e.target.value || !Number.isFinite(e.target.valueAsNumber)) return; const n = clamp(e.target.valueAsNumber, -500, 500); dispatch({ type: 'edit', update: d => ({ ...d, points: d.points.map((p, i) => i === selected ? { ...p, [axis]: n } : p) }) }) }} /></label>)}</div></> : <p className="field-note">Select a node to edit its coordinates.</p>}
          {draft.length > 0 && <button className="primary finish-button" disabled={draft.length < 3} onClick={finishDraft}>Finish contour ({draft.length} points)</button>}
        </section>
        <section><h2>Appearance</h2><div className="color-row"><label><input type="color" aria-label="Motif color" value={doc.fill} onChange={e => change('fill', e.target.value)} /><span>Motif<small>{doc.fill.toUpperCase()}</small></span></label><label><input type="color" aria-label="Background color" value={doc.background} onChange={e => change('background', e.target.value)} /><span>Canvas<small>{doc.background.toUpperCase()}</small></span></label></div><Range label="Outline width" value={doc.strokeWidth} min={0} max={8} step={0.5} unit=" px" onChange={n => change('strokeWidth', n)} begin={begin} end={end} />{doc.strokeWidth > 0 && <label className="stroke-color">Outline color<input type="color" aria-label="Outline color" value={doc.stroke} onChange={e => change('stroke', e.target.value)} /></label>}
          <div className="section-heading palette-heading"><h2>Palette explorations</h2><span>06</span></div><div className="palettes">{palettes.map(([fill, background], i) => <button key={fill} style={{ background }} title={`Apply palette ${i + 1}`} aria-label={`Apply palette ${i + 1}`} onClick={() => dispatch({ type: 'edit', update: d => ({ ...d, fill, background }) })}><span style={{ background: fill }} /></button>)}</div></section>
        <div className="geometry-note"><span>GEOMETRY NOTE</span><p>Free motif repetition. Shapes can overlap or leave gaps; tile edges aren’t constrained yet.</p></div>
      </aside>
    </div>
    {message && <div className="toast" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><Icon name="close" size={14} /></button></div>}
    {exportOpen && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setExportOpen(false) }}><div className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title" onKeyDown={e => { if (e.key === 'Escape') setExportOpen(false); if (e.key === 'Tab') { const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input')); const first = els[0], last = els.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() } } }}><div className="modal-heading"><div><p className="eyebrow">FROM EXPLORATION TO ARTWORK</p><h2 id="export-title">Export your pattern</h2></div><button className="icon-button" aria-label="Close export" autoFocus onClick={() => setExportOpen(false)}><Icon name="close" /></button></div><div className="export-thumbnail" style={{ background: doc.background }}><svg viewBox="-260 -100 520 200"><defs><path id="export-thumb-motif" d={pathData(doc.points, doc.smooth)} /></defs>{instances(doc, { x: -260, y: -100, width: 520, height: 200 }).map(c => <use key={c.id} href="#export-thumb-motif" transform={matrixText(c.matrix)} fill={doc.fill} stroke={doc.stroke} strokeWidth={doc.strokeWidth} />)}</svg></div><div className="export-dimensions"><label>Width, px<input aria-label="Export width" type="number" min={1} max={16000} value={width} onChange={e => setWidth(e.target.valueAsNumber || 0)} /></label><span>×</span><label>Height, px<input aria-label="Export height" type="number" min={1} max={16000} value={height} onChange={e => setHeight(e.target.valueAsNumber || 0)} /></label></div><label className="export-scale">Pattern scale<span><input aria-label="Export pattern scale" type="number" min={25} max={400} value={exportScale} onChange={e => setExportScale(e.target.valueAsNumber || 0)} />%</span></label><p className="field-note">Centered on the motif, cropped to your dimensions. The SVG keeps editable vector paths and reusable instances. Guides are excluded.</p><div className="export-buttons"><button disabled={exporting} onClick={() => download('png')}>Export PNG</button><button className="primary" disabled={exporting} onClick={() => download('svg')}><Icon name="download" size={16} />{exporting ? 'Preparing…' : 'Export SVG'}</button></div></div></div>}
  </div>
}

type CanvasProps = {
  doc: PatternDocument; view: View; setView: (v: View | ((v: View) => View)) => void; focus: boolean; guides: boolean; tool: Tool; selected: number | null; setSelected: (i: number | null) => void;
  draft: Point[]; onDraftPoint: (p: Point) => void; finishDraft: () => void; dispatch: React.Dispatch<import('./core/history').Action>
}
function Canvas({ doc, view, setView, focus, guides, tool, selected, setSelected, draft, onDraftPoint, finishDraft, dispatch }: CanvasProps) {
  const container = useRef<HTMLDivElement>(null), svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 800, height: 650 })
  const drag = useRef<{ kind: 'node'; index: number } | { kind: 'pan'; x: number; y: number; view: View } | null>(null)
  const id = useId().replace(/:/g, '')
  useEffect(() => {
    const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; if (width && height) setSize({ width, height }) })
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const bounds = { x: view.x - size.width / view.zoom / 2, y: view.y - size.height / view.zoom / 2, width: size.width / view.zoom, height: size.height / view.zoom }
  let copies: ReturnType<typeof instances> = [], warning = ''
  try { copies = instances(doc, bounds) } catch (e) { warning = e instanceof Error ? e.message : 'Preview limit reached' }
  function point(event: ReactPointerEvent<SVGElement>): Point {
    const svg = svgRef.current!, matrix = svg.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY
    const world = p.matrixTransform(matrix.inverse())
    const local = inversePoint(world, rotation(doc.angle))
    return { x: clamp(local.x, -500, 500), y: clamp(local.y, -500, 500) }
  }
  function start(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.button !== 1) return
    if (!focus || tool === 'hand' || event.button === 1) {
      event.preventDefault(); drag.current = { kind: 'pan', x: event.clientX, y: event.clientY, view }; event.currentTarget.setPointerCapture(event.pointerId)
    } else if (tool === 'pen') { onDraftPoint(point(event)); setSelected(null) }
    else setSelected(null)
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const active = drag.current
    if (!active) return
    if (active.kind === 'pan') setView({ ...active.view, x: active.view.x - (event.clientX - active.x) / active.view.zoom, y: active.view.y - (event.clientY - active.y) / active.view.zoom })
    else { const p = point(event); dispatch({ type: 'live', update: d => ({ ...d, points: d.points.map((old, i) => i === active.index ? p : old) }) }) }
  }
  function stop(cancel = false) {
    if (drag.current?.kind === 'node') dispatch({ type: cancel ? 'cancel' : 'end' })
    drag.current = null
  }
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (drag.current?.kind === 'node') dispatch({ type: 'cancel' }); drag.current = null } }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [dispatch])
  function zoom(factor: number) { setView(v => ({ ...v, zoom: clamp(v.zoom * factor, 0.35, 3) })) }
  const sourceTransform = matrixText(rotation(doc.angle))
  const path = pathData(doc.points, doc.smooth)
  return <div className={`canvas-pane ${focus ? 'focus-pane' : 'pattern-pane'} tool-${tool}`} ref={container}>
    <div className="pane-label"><span className={focus ? 'label-dot' : 'label-dot pattern-dot'} />{focus ? 'SOURCE + CONTEXT' : 'PATTERN PREVIEW'}{!focus && <span className="live-label">LIVE</span>}</div>
    <svg ref={svgRef} className="drawing-canvas" role="img" aria-label={focus ? 'Editable motif and live repeated context' : 'Live pattern preview, drag to pan'} viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} style={{ background: doc.background }} onPointerDown={start} onPointerMove={move} onPointerUp={() => stop()} onPointerCancel={() => stop(true)} onLostPointerCapture={() => stop()} onWheel={event => { zoom(Math.exp(-event.deltaY * 0.0015)) }}>
      <defs><path id={`motif-${id}`} d={path} /><pattern id={`dots-${id}`} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r={0.7 / view.zoom} fill="#66705c" opacity=".22" /></pattern></defs>
      {focus && guides && <rect {...bounds} fill={`url(#dots-${id})`} pointerEvents="none" />}
      <g opacity={focus ? 0.28 : 1} pointerEvents="none">{copies.filter(c => !focus || !c.source).map(copy => <use key={copy.id} href={`#motif-${id}`} transform={matrixText(copy.matrix)} fill={doc.fill} stroke={doc.stroke} strokeWidth={doc.strokeWidth} />)}</g>
      {focus && <>
        {guides && <g pointerEvents="none"><circle cx="0" cy="0" r="135" fill={doc.background} fillOpacity=".62" stroke="#647154" strokeOpacity=".17" strokeWidth={1 / view.zoom} /><path d={`M ${-doc.spacingX / 2} ${-doc.spacingY / 2} h ${doc.spacingX} v ${doc.spacingY} h ${-doc.spacingX} Z`} fill="none" stroke="#647154" strokeOpacity=".45" strokeDasharray="4 5" strokeWidth={1 / view.zoom} /><path d="M-7 0h14M0-7v14" stroke="#647154" opacity=".4" strokeWidth={1 / view.zoom} /></g>}
        <g transform={sourceTransform}>
          <use href={`#motif-${id}`} fill={doc.fill} stroke={doc.strokeWidth ? doc.stroke : '#34472e'} strokeWidth={doc.strokeWidth || 0.7 / view.zoom} />
          {tool === 'nodes' && !draft.length && <><path d={doc.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + ' Z'} fill="none" stroke="#354d2c" strokeWidth={0.7 / view.zoom} strokeDasharray={`${3 / view.zoom} ${4 / view.zoom}`} opacity=".4" pointerEvents="none" />{doc.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(selected === i ? 5 : 3.7) / view.zoom} fill={selected === i ? '#344d2b' : '#fcfcf7'} stroke={selected === i ? '#fcfcf7' : '#344d2b'} strokeWidth={1.5 / view.zoom} className="node" role="button" tabIndex={0} aria-label={`Node ${i + 1}, x ${Math.round(p.x)}, y ${Math.round(p.y)}`} onFocus={() => setSelected(i)} onPointerDown={event => { if (event.button !== 0) return; event.stopPropagation(); setSelected(i); dispatch({ type: 'begin' }); drag.current = { kind: 'node', index: i }; svgRef.current?.setPointerCapture(event.pointerId) }} />)}</>}
          {draft.length > 0 && <>{draft.length === 1 && <circle cx={draft[0].x} cy={draft[0].y} r={4 / view.zoom} fill={doc.fill} />}{draft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 6 : 3) / view.zoom} fill={i === 0 ? '#fff' : '#344d2b'} stroke="#344d2b" strokeWidth={1 / view.zoom} className="node" role={i === 0 ? 'button' : undefined} tabIndex={i === 0 ? 0 : undefined} aria-label={i === 0 ? 'Close contour' : undefined} onKeyDown={event => { if (i === 0 && event.key === 'Enter') { event.stopPropagation(); finishDraft() } }} onPointerDown={event => { if (i === 0) { event.stopPropagation(); finishDraft() } }} />)}</>}
        </g>
      </>}
    </svg>
    {focus && !draft.length && <div className="canvas-help"><span className="help-key">{tool === 'nodes' ? 'V' : tool === 'pen' ? 'P' : 'H'}</span>{tool === 'nodes' ? 'Grab a node. Find a new form.' : tool === 'pen' ? 'Click to draw your own motif.' : 'Drag to explore the plane.'}</div>}
    {warning && <div className="canvas-warning" role="status">{warning}</div>}
    <div className="zoom-controls"><button aria-label={focus ? 'Zoom out' : 'Preview zoom out'} title="Zoom out" onClick={() => zoom(1 / 1.2)}><Icon name="minus" size={14} /></button><span>{Math.round(view.zoom * 100)}%</span><button aria-label={focus ? 'Zoom in' : 'Preview zoom in'} title="Zoom in" onClick={() => zoom(1.2)}><Icon name="plus" size={14} /></button><span className="zoom-divider" /><button aria-label={focus ? 'Reset canvas view' : 'Reset preview view'} title="Reset view" onClick={() => setView({ x: 0, y: 0, zoom: focus ? 1.25 : 0.65 })}><Icon name="fit" size={14} /></button></div>
  </div>
}
export default App
