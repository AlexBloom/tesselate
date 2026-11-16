export type Point = { x: number; y: number }
export type Matrix = [number, number, number, number, number, number]
export type Bounds = { x: number; y: number; width: number; height: number }
export type RepeatMode = 'grid' | 'brick' | 'hex' | 'radial'
export type Layer = { id: string; name: string; visible: boolean; locked: boolean }
export type Shape = {
  layerId: string
  id: string
  name: string
  points: Point[]
  smooth: number
  fill: string
  stroke: string
  strokeWidth: number
  visible: boolean
}
export type TileOptions = { enabled: boolean; rotation: boolean; mirror: boolean; offset: boolean }
export type PatternDocument = {
  title?: string
  tileOptions?: TileOptions
  version: 3
  layers: Layer[]
  flipX: boolean
  flipY: boolean
  offsetX: number
  offsetY: number
  rotationStep: number
  stepAxis: 'column' | 'row' | 'diagonal' | 'checker'
  latticeAngle: number
  patternX: number
  patternY: number
  shapes: Shape[]
  repeat: RepeatMode
  spacingX: number
  spacingY: number
  angle: number
  mirror: boolean
  sectors: number
  background: string
}
export type Instance = { id: string; matrix: Matrix; cellMatrix: Matrix; source: boolean }
export const initialShape: Shape = {
  id: 'shape-1', layerId: 'layer-1', name: 'Square 1',
  points: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }],
  smooth: 0, fill: '#62794c', stroke: '#34472e', strokeWidth: 0, visible: true,
}
export const initialLayer: Layer = { id: 'layer-1', name: 'Layer 1', visible: true, locked: false }
export const initialDocument: PatternDocument = {
  version: 3, layers: [initialLayer], flipX: false, flipY: false, offsetX: 0, offsetY: 0, rotationStep: 0, stepAxis: 'column', latticeAngle: 0, patternX: 0, patternY: 0, shapes: [initialShape], repeat: 'brick', spacingX: 185, spacingY: 173,
  angle: 0, mirror: false, sectors: 8, background: '#f4f2e9',
}

export function updateShape(doc: PatternDocument, id: string, update: (shape: Shape) => Shape): PatternDocument {
  return { ...doc, shapes: doc.shapes.map(shape => shape.id === id ? update(shape) : shape) }
}
export function addShape(doc: PatternDocument, shape: Shape): PatternDocument {
  if (doc.shapes.length >= 64) throw new Error('A document can contain up to 64 objects.')
  if (!doc.layers.some(l => l.id === shape.layerId)) throw new Error('Object needs a valid layer.')
  if (doc.shapes.some(s => s.id === shape.id)) throw new Error('Shape IDs must be unique.')
  return { ...doc, shapes: [...doc.shapes, shape] }
}
export function removeShape(doc: PatternDocument, id: string): PatternDocument { return { ...doc, shapes: doc.shapes.filter(s => s.id !== id) } }
export function orderedShapes(doc: PatternDocument): Shape[] { return doc.layers.flatMap(layer => doc.shapes.filter(s => s.layerId === layer.id)) }
export function visibleShapes(doc: PatternDocument): Shape[] { return doc.layers.filter(l => l.visible).flatMap(layer => doc.shapes.filter(s => s.layerId === layer.id && s.visible)) }
export function editableShape(doc: PatternDocument, shape: Shape): boolean { const layer = doc.layers.find(l => l.id === shape.layerId); return Boolean(layer?.visible && !layer.locked && shape.visible) }
export function addLayer(doc: PatternDocument, layer: Layer): PatternDocument {
  if (doc.layers.length >= 32 || doc.layers.some(l => l.id === layer.id)) throw new Error('Use up to 32 uniquely identified layers.')
  return { ...doc, layers: [...doc.layers, layer] }
}
export function updateLayer(doc: PatternDocument, id: string, update: (layer: Layer) => Layer): PatternDocument { return { ...doc, layers: doc.layers.map(l => l.id === id ? update(l) : l) } }
export function removeLayer(doc: PatternDocument, id: string): PatternDocument { return doc.layers.length <= 1 ? doc : { ...doc, layers: doc.layers.filter(l => l.id !== id), shapes: doc.shapes.filter(s => s.layerId !== id) } }
export function moveToLayer(doc: PatternDocument, id: string, layerId: string): PatternDocument {
  const layer = doc.layers.find(l => l.id === layerId), object = doc.shapes.find(s => s.id === id)
  if (!object || !layer || layer.locked || doc.layers.find(l=>l.id===object.layerId)?.locked) return doc
  return { ...doc, shapes: [...doc.shapes.filter(s => s.id !== id), { ...object, layerId }] }
}

export function shapeCenter(shape: Shape): Point {
  return { x: (Math.min(...shape.points.map(p => p.x)) + Math.max(...shape.points.map(p => p.x))) / 2, y: (Math.min(...shape.points.map(p => p.y)) + Math.max(...shape.points.map(p => p.y))) / 2 }
}
/** Clamp the translation as a unit; do not deform a shape at the workspace limit. */
export function translateShape(shape: Shape, delta: Point): Shape {
  const x = Math.max(-2000 - Math.min(...shape.points.map(p => p.x)), Math.min(2000 - Math.max(...shape.points.map(p => p.x)), delta.x))
  const y = Math.max(-2000 - Math.min(...shape.points.map(p => p.y)), Math.min(2000 - Math.max(...shape.points.map(p => p.y)), delta.y))
  return { ...shape, points: shape.points.map(p => ({ x: p.x + x, y: p.y + y })) }
}

export function transformPoint(p: Point, m: Matrix): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }
}
export function rotation(degrees: number, x = 0, y = 0, reflect = false): Matrix {
  const a = degrees * Math.PI / 180
  const sign = reflect ? -1 : 1
  return [Math.cos(a) * sign, Math.sin(a) * sign, -Math.sin(a), Math.cos(a), x, y]
}
/** multiply(a,b) applies b first, then a. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]]
}
export function placementMatrix(doc: PatternDocument): Matrix { return rotation(doc.latticeAngle, doc.patternX, doc.patternY) }
export function tileOptions(doc: PatternDocument): TileOptions {
  if(doc.tileOptions)return doc.tileOptions
  const rotation=doc.angle!==0||doc.rotationStep!==0,mirror=doc.flipX||doc.flipY||doc.mirror,offset=doc.offsetX!==0||doc.offsetY!==0
  return {enabled:rotation||mirror||offset,rotation,mirror,offset}
}
export function effectiveTile(doc: PatternDocument) {
  const options=tileOptions(doc), rotation=options.enabled&&options.rotation,mirror=options.enabled&&options.mirror,offset=options.enabled&&options.offset
  return {angle:rotation?doc.angle:0,rotationStep:rotation?doc.rotationStep:0,flipX:mirror&&doc.flipX,flipY:mirror&&doc.flipY,mirror:mirror&&doc.mirror,offsetX:offset?doc.offsetX:0,offsetY:offset?doc.offsetY:0}
}

export function tileInstance(doc: PatternDocument, col: number, row: number): Instance {
  const global = placementMatrix(doc), contentSettings=effectiveTile(doc)
  const phase = doc.stepAxis === 'column' ? col : doc.stepAxis === 'row' ? row : doc.stepAxis === 'diagonal' ? col + row : Math.abs((col + row) % 2)
  let cellMatrix: Matrix, alternate: boolean
  if (doc.repeat === 'radial') {
    alternate = contentSettings.mirror && col % 2 !== 0
    cellMatrix = multiply(global, rotation((col + (alternate ? 1 : 0)) * 360 / doc.sectors, 0, 0, alternate))
    alternate = false
  } else {
    const step = latticeSteps(doc), shift = doc.repeat !== 'grid' && Math.abs(row % 2) === 1 ? step.x / 2 : 0
    cellMatrix = multiply(global, [1,0,0,1,col*step.x+shift,row*step.y])
    alternate = contentSettings.mirror && Math.abs((col + row) % 2) === 1
  }
  const flip: Matrix = [(contentSettings.flipX !== alternate) ? -1 : 1,0,0,contentSettings.flipY ? -1 : 1,0,0]
  const base = multiply([1,0,0,1,contentSettings.offsetX,contentSettings.offsetY], multiply(rotation(contentSettings.angle), flip))
  const content = multiply(rotation(doc.repeat === 'radial' ? 0 : phase * contentSettings.rotationStep), base)
  return { id: doc.repeat === 'radial' ? `r${col}` : `${row}:${col}`, cellMatrix, matrix: multiply(cellMatrix, content), source: col === 0 && row === 0 }
}

export function inversePoint(p: Point, m: Matrix): Point {
  const d = m[0] * m[3] - m[1] * m[2]
  if (Math.abs(d) < 1e-12) throw new Error('Singular transform')
  const x = p.x - m[4], y = p.y - m[5]
  return { x: (m[3] * x - m[2] * y) / d, y: (-m[1] * x + m[0] * y) / d }
}
const number = (n: number) => Number(n.toFixed(5))
export function matrixText(m: Matrix): string { return `matrix(${m.map(number).join(' ')})` }

/** Closed Catmull-Rom contour converted into explicit cubic Bézier segments. */
export function pathData(points: Point[], smooth = 0): string {
  if (points.length < 2) return ''
  const n = points.length
  const first = points[0]
  let path = `M ${number(first.x)} ${number(first.y)}`
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n], p = points[i]
    const next = points[(i + 1) % n], after = points[(i + 2) % n]
    if (smooth === 0) path += ` L ${number(next.x)} ${number(next.y)}`
    else path += ` C ${number(p.x + (next.x - prev.x) * smooth / 6)} ${number(p.y + (next.y - prev.y) * smooth / 6)} ${number(next.x - (after.x - p.x) * smooth / 6)} ${number(next.y - (after.y - p.y) * smooth / 6)} ${number(next.x)} ${number(next.y)}`
  }
  return path + ' Z'
}

/** Radius includes Bézier control points, so culling is conservative for curved paths. */
export function motifRadius(doc: PatternDocument): number {
  let radius = 0
  for (const shape of visibleShapes(doc)) {
    const points = shape.points, n = points.length
    for (let i = 0; i < n; i++) {
      const p = points[i], prev = points[(i - 1 + n) % n], next = points[(i + 1) % n]
      const offset = { x: (next.x - prev.x) * shape.smooth / 6, y: (next.y - prev.y) * shape.smooth / 6 }
      for (const q of [p, { x: p.x + offset.x, y: p.y + offset.y }, { x: p.x - offset.x, y: p.y - offset.y }]) radius = Math.max(radius, Math.hypot(q.x, q.y) + shape.strokeWidth / 2)
    }
  }
  const content=effectiveTile(doc)
  return radius + Math.hypot(content.offsetX, content.offsetY)
}

export function latticeSteps(doc: PatternDocument): Point {
  return { x: doc.spacingX, y: doc.repeat === 'hex' ? doc.spacingX * Math.sqrt(3) / 2 : doc.spacingY }
}
/** Cell boundaries use the same lattice basis as repetition, independently of motif rotation. */
export function guideGeometry(doc: PatternDocument): { label: string; path: string; radius: number } {
  const { x: dx, y: dy } = latticeSteps(doc)
  if (doc.repeat === 'hex') {
    const r = dx / Math.sqrt(3)
    return { label: 'Hexagon cell', path: pathData([{ x: 0, y: -r }, { x: dx / 2, y: -r / 2 }, { x: dx / 2, y: r / 2 }, { x: 0, y: r }, { x: -dx / 2, y: r / 2 }, { x: -dx / 2, y: -r / 2 }]), radius: r }
  }
  if (doc.repeat === 'radial') {
    const r = Math.max(120, motifRadius(doc) + 15), a = 2 * Math.PI / doc.sectors
    return { label: 'Radial sector', path: `M 0 0 L 0 ${-r} A ${r} ${r} 0 0 1 ${number(Math.sin(a) * r)} ${number(-Math.cos(a) * r)} Z`, radius: r }
  }
  const shift = doc.repeat === 'brick' ? dx / 2 : 0
  return { label: doc.repeat === 'brick' ? 'Half-drop cell' : 'Grid cell', path: pathData([{ x: -(dx + shift) / 2, y: -dy / 2 }, { x: (dx - shift) / 2, y: -dy / 2 }, { x: (dx + shift) / 2, y: dy / 2 }, { x: -(dx - shift) / 2, y: dy / 2 }]), radius: Math.hypot((dx + shift) / 2, dy / 2) }
}
export function guideMatrix(_doc: PatternDocument, copy: Instance): Matrix {
  return copy.cellMatrix
}

export function instances(doc: PatternDocument, bounds: Bounds, limit = 4000, padding = 0): Instance[] {
  if (doc.repeat === 'radial') return Array.from({ length: doc.sectors }, (_, i) => tileInstance(doc, i, 0))
  const radius = Math.max(motifRadius(doc), padding), global = placementMatrix(doc)
  const corners = [{x:bounds.x,y:bounds.y},{x:bounds.x+bounds.width,y:bounds.y},{x:bounds.x,y:bounds.y+bounds.height},{x:bounds.x+bounds.width,y:bounds.y+bounds.height}].map(p => inversePoint(p, global))
  const left = Math.min(...corners.map(p=>p.x)), right = Math.max(...corners.map(p=>p.x)), top = Math.min(...corners.map(p=>p.y)), bottom = Math.max(...corners.map(p=>p.y))
  const { x: dx, y: dy } = latticeSteps(doc)
  const result: Instance[] = []
  for (let row = Math.ceil((top-radius)/dy); row <= Math.floor((bottom+radius)/dy); row++) {
    const shift = doc.repeat !== 'grid' && Math.abs(row % 2) === 1 ? dx / 2 : 0
    for (let col = Math.ceil((left-radius-shift)/dx); col <= Math.floor((right+radius-shift)/dx); col++) {
      if (result.length >= limit) throw new Error('Too many repeats. Increase spacing or reduce the output area.')
      result.push(tileInstance(doc, col, row))
    }
  }
  return result
}

export function exportSVG(doc: PatternDocument, width: number, height: number, scale = 1): string {
  if (![width, height, scale].every(Number.isFinite) || width < 1 || height < 1 || width > 16000 || height > 16000 || scale < 0.25 || scale > 4) throw new Error('Use dimensions from 1–16000 and scale from 25–400%.')
  if (!validDocument(doc)) throw new Error('Invalid pattern document')
  const w = width / scale, h = height / scale
  const bounds = { x: -w / 2, y: -h / 2, width: w, height: h }
  const copies = instances(doc, bounds, 100000)
  const visible = visibleShapes(doc)
  if (copies.length * visible.length > 100000) throw new Error('Too many shapes to export. Increase spacing or reduce the output area.')
  const paths = visible.map((shape, i) => `<path id="shape-${i}" d="${pathData(shape.points, shape.smooth)}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linejoin="round"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-w / 2} ${-h / 2} ${w} ${h}"><title>Tesselate pattern</title><defs><clipPath id="artboard"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"/></clipPath><g id="motif">${paths}</g></defs><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${doc.background}"/><g clip-path="url(#artboard)">${copies.map(copy => `<use href="#motif" transform="${matrixText(copy.matrix)}"/>`).join('')}</g></svg>`
}

const color = (c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
const inRange = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
export function validDocument(value: unknown): value is PatternDocument {
  if (!value || typeof value !== 'object') return false
  const d = value as PatternDocument
  return d.version === 3 && (d.title===undefined||(typeof d.title==='string'&&d.title.length<=120))
    && (d.tileOptions===undefined||(d.tileOptions!==null&&typeof d.tileOptions==='object'&&['enabled','rotation','mirror','offset'].every(k=>typeof d.tileOptions![k as keyof TileOptions]==='boolean')))
    && Array.isArray(d.layers) && d.layers.length >= 1 && d.layers.length <= 32
    && new Set(d.layers.map(l => l?.id)).size === d.layers.length
    && d.layers.every(l => l && typeof l.id === 'string' && l.id.length > 0 && l.id.length <= 100 && typeof l.name === 'string' && l.name.length <= 80 && typeof l.visible === 'boolean' && typeof l.locked === 'boolean')
    && ['flipX','flipY'].every(k => typeof d[k as 'flipX'] === 'boolean')
    && [d.offsetX,d.offsetY].every(n => inRange(n,-500,500))
    && [d.patternX,d.patternY].every(n => inRange(n,-1000,1000))
    && inRange(d.latticeAngle,-180,180) && inRange(d.rotationStep,-360,360) && ['column','row','diagonal','checker'].includes(d.stepAxis)
    && Array.isArray(d.shapes) && d.shapes.length <= 64
    && new Set(d.shapes.map(s => s?.id)).size === d.shapes.length
    && d.shapes.every(s => s && d.layers.some(l => l.id === s.layerId) && typeof s.id === 'string' && s.id.length > 0 && s.id.length <= 100 && typeof s.name === 'string' && s.name.length <= 80 && typeof s.visible === 'boolean'
      && Array.isArray(s.points) && s.points.length >= 3 && s.points.length <= 300 && s.points.every(p => p && inRange(p.x, -2000, 2000) && inRange(p.y, -2000, 2000))
      && color(s.fill) && color(s.stroke) && inRange(s.smooth, 0, 1) && inRange(s.strokeWidth, 0, 8))
    && ['grid', 'brick', 'hex', 'radial'].includes(d.repeat) && color(d.background) && typeof d.mirror === 'boolean'
    && inRange(d.spacingX, 60, 400) && inRange(d.spacingY, 60, 400) && inRange(d.angle, -180, 180) && inRange(d.sectors, 2, 24) && Number.isInteger(d.sectors)
}
/** Preserve previous storage keys as backups; migrate old objects into a single container layer. */
export function migrateDocument(value: unknown): PatternDocument | null {
  if (validDocument(value)) return value
  if (!value || typeof value !== 'object') return null
  const old = value as Record<string, unknown>
  let shapes: Shape[]
  if (old.version === 2 && Array.isArray(old.shapes)) shapes = old.shapes.map(s => ({ ...s, layerId: initialLayer.id }))
  else if (Array.isArray(old.points)) shapes = [{ id: 'shape-1', layerId: initialLayer.id, name: 'Square 1', points: old.points, smooth: old.smooth, fill: old.fill, stroke: old.stroke, strokeWidth: old.strokeWidth, visible: true }] as Shape[]
  else return null
  const migrated = { ...initialDocument, repeat: old.repeat, spacingX: old.spacingX, spacingY: old.spacingY, angle: old.repeat === 'radial' ? 0 : old.angle, latticeAngle: old.repeat === 'radial' ? old.angle : 0, mirror: old.mirror, sectors: old.sectors, background: old.background, shapes }
  return validDocument(migrated) ? migrated : null
}
