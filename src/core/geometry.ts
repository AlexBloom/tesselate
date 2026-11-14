export type Point = { x: number; y: number }
export type Matrix = [number, number, number, number, number, number]
export type Bounds = { x: number; y: number; width: number; height: number }
export type RepeatMode = 'grid' | 'brick' | 'hex' | 'radial'
export type Shape = {
  id: string
  name: string
  points: Point[]
  smooth: number
  fill: string
  stroke: string
  strokeWidth: number
  visible: boolean
}
export type PatternDocument = {
  version: 2
  shapes: Shape[]
  repeat: RepeatMode
  spacingX: number
  spacingY: number
  angle: number
  mirror: boolean
  sectors: number
  background: string
}
export type Instance = { id: string; matrix: Matrix; source: boolean }
export const initialShape: Shape = {
  id: 'shape-1', name: 'Botanical',
  points: [{ x: 0, y: -79 }, { x: 37, y: -40 }, { x: 78, y: -27 }, { x: 47, y: 9 }, { x: 44, y: 69 }, { x: 0, y: 48 }, { x: -44, y: 69 }, { x: -47, y: 9 }, { x: -78, y: -27 }, { x: -37, y: -40 }],
  smooth: 0.8, fill: '#62794c', stroke: '#34472e', strokeWidth: 0, visible: true,
}
export const initialDocument: PatternDocument = {
  version: 2, shapes: [initialShape], repeat: 'brick', spacingX: 185, spacingY: 173,
  angle: 0, mirror: false, sectors: 8, background: '#f4f2e9',
}

export function updateShape(doc: PatternDocument, id: string, update: (shape: Shape) => Shape): PatternDocument {
  return { ...doc, shapes: doc.shapes.map(shape => shape.id === id ? update(shape) : shape) }
}
export function addShape(doc: PatternDocument, shape: Shape): PatternDocument {
  if (doc.shapes.length >= 64) throw new Error('A motif can contain up to 64 shapes.')
  if (doc.shapes.some(s => s.id === shape.id)) throw new Error('Shape IDs must be unique.')
  return { ...doc, shapes: [...doc.shapes, shape] }
}
export function removeShape(doc: PatternDocument, id: string): PatternDocument { return { ...doc, shapes: doc.shapes.filter(s => s.id !== id) } }
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
  for (const shape of doc.shapes.filter(s => s.visible)) {
    const points = shape.points, n = points.length
    for (let i = 0; i < n; i++) {
      const p = points[i], prev = points[(i - 1 + n) % n], next = points[(i + 1) % n]
      const offset = { x: (next.x - prev.x) * shape.smooth / 6, y: (next.y - prev.y) * shape.smooth / 6 }
      for (const q of [p, { x: p.x + offset.x, y: p.y + offset.y }, { x: p.x - offset.x, y: p.y - offset.y }]) radius = Math.max(radius, Math.hypot(q.x, q.y) + shape.strokeWidth / 2)
    }
  }
  return radius
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
export function guideMatrix(doc: PatternDocument, copy: Instance): Matrix {
  return doc.repeat === 'radial' ? copy.matrix : [1, 0, 0, 1, copy.matrix[4], copy.matrix[5]]
}

export function instances(doc: PatternDocument, bounds: Bounds, limit = 4000, padding = 0): Instance[] {
  if (doc.repeat === 'radial') return Array.from({ length: doc.sectors }, (_, i) => ({ id: `r${i}`, matrix: rotation(doc.angle + (i + (doc.mirror && i % 2 === 1 ? 1 : 0)) * 360 / doc.sectors, 0, 0, doc.mirror && i % 2 === 1), source: i === 0 }))
  const radius = Math.max(motifRadius(doc), padding)
  const { x: dx, y: dy } = latticeSteps(doc)
  const rows = [Math.ceil((bounds.y - radius) / dy), Math.floor((bounds.y + bounds.height + radius) / dy)]
  const result: Instance[] = []
  for (let row = rows[0]; row <= rows[1]; row++) {
    const shift = doc.repeat !== 'grid' && Math.abs(row % 2) === 1 ? dx / 2 : 0
    const min = Math.ceil((bounds.x - radius - shift) / dx), max = Math.floor((bounds.x + bounds.width + radius - shift) / dx)
    for (let col = min; col <= max; col++) {
      if (result.length >= limit) throw new Error('Too many repeats. Increase spacing or reduce the output area.')
      result.push({ id: `${row}:${col}`, matrix: rotation(doc.angle, col * dx + shift, row * dy, doc.mirror && Math.abs((col + row) % 2) === 1), source: row === 0 && col === 0 })
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
  const visible = doc.shapes.filter(s => s.visible)
  if (copies.length * visible.length > 100000) throw new Error('Too many shapes to export. Increase spacing or reduce the output area.')
  const paths = visible.map((shape, i) => `<path id="shape-${i}" d="${pathData(shape.points, shape.smooth)}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linejoin="round"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-w / 2} ${-h / 2} ${w} ${h}"><title>Tesselate pattern</title><defs><clipPath id="artboard"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"/></clipPath><g id="motif">${paths}</g></defs><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${doc.background}"/><g clip-path="url(#artboard)">${copies.map(copy => `<use href="#motif" transform="${matrixText(copy.matrix)}"/>`).join('')}</g></svg>`
}

const color = (c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
const inRange = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
export function validDocument(value: unknown): value is PatternDocument {
  if (!value || typeof value !== 'object') return false
  const d = value as PatternDocument
  return d.version === 2 && Array.isArray(d.shapes) && d.shapes.length <= 64
    && new Set(d.shapes.map(s => s?.id)).size === d.shapes.length
    && d.shapes.every(s => s && typeof s.id === 'string' && s.id.length > 0 && s.id.length <= 100 && typeof s.name === 'string' && s.name.length <= 80 && typeof s.visible === 'boolean'
      && Array.isArray(s.points) && s.points.length >= 3 && s.points.length <= 300 && s.points.every(p => p && inRange(p.x, -2000, 2000) && inRange(p.y, -2000, 2000))
      && color(s.fill) && color(s.stroke) && inRange(s.smooth, 0, 1) && inRange(s.strokeWidth, 0, 8))
    && ['grid', 'brick', 'hex', 'radial'].includes(d.repeat) && color(d.background) && typeof d.mirror === 'boolean'
    && inRange(d.spacingX, 60, 400) && inRange(d.spacingY, 60, 400) && inRange(d.angle, -180, 180) && inRange(d.sectors, 2, 24) && Number.isInteger(d.sectors)
}
/** Upgrade v1 without changing its shape geometry or appearance. The original storage key is retained as a backup. */
export function migrateDocument(value: unknown): PatternDocument | null {
  if (validDocument(value)) return value
  if (!value || typeof value !== 'object') return null
  const old = value as Record<string, unknown>
  if (!Array.isArray(old.points)) return null
  const migrated = { version: 2, shapes: [{ id: 'shape-1', name: 'Motif 01', points: old.points, smooth: old.smooth, fill: old.fill, stroke: old.stroke, strokeWidth: old.strokeWidth, visible: true }], repeat: old.repeat, spacingX: old.spacingX, spacingY: old.spacingY, angle: old.angle, mirror: old.mirror, sectors: old.sectors, background: old.background }
  return validDocument(migrated) ? migrated : null
}
