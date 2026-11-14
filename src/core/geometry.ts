export type Point = { x: number; y: number }
export type Matrix = [number, number, number, number, number, number]
export type Bounds = { x: number; y: number; width: number; height: number }
export type RepeatMode = 'grid' | 'brick' | 'hex' | 'radial'
export type PatternDocument = {
  points: Point[]
  smooth: number
  repeat: RepeatMode
  spacingX: number
  spacingY: number
  angle: number
  mirror: boolean
  sectors: number
  fill: string
  background: string
  stroke: string
  strokeWidth: number
}
export type Instance = { id: string; matrix: Matrix; source: boolean }

export const initialDocument: PatternDocument = {
  points: [{ x: 0, y: -79 }, { x: 37, y: -40 }, { x: 78, y: -27 }, { x: 47, y: 9 }, { x: 44, y: 69 }, { x: 0, y: 48 }, { x: -44, y: 69 }, { x: -47, y: 9 }, { x: -78, y: -27 }, { x: -37, y: -40 }],
  smooth: 0.8, repeat: 'brick', spacingX: 185, spacingY: 173, angle: 0,
  mirror: false, sectors: 8, fill: '#62794c', background: '#f4f2e9', stroke: '#34472e', strokeWidth: 0,
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
  const points = doc.points, n = points.length
  for (let i = 0; i < n; i++) {
    const p = points[i], prev = points[(i - 1 + n) % n], next = points[(i + 1) % n]
    const offset = { x: (next.x - prev.x) * doc.smooth / 6, y: (next.y - prev.y) * doc.smooth / 6 }
    for (const q of [p, { x: p.x + offset.x, y: p.y + offset.y }, { x: p.x - offset.x, y: p.y - offset.y }]) radius = Math.max(radius, Math.hypot(q.x, q.y))
  }
  return radius + doc.strokeWidth / 2
}

export function instances(doc: PatternDocument, bounds: Bounds, limit = 4000): Instance[] {
  if (doc.repeat === 'radial') return Array.from({ length: doc.sectors }, (_, i) => ({ id: `r${i}`, matrix: rotation(doc.angle + (i + (doc.mirror && i % 2 === 1 ? 1 : 0)) * 360 / doc.sectors, 0, 0, doc.mirror && i % 2 === 1), source: i === 0 }))
  const radius = motifRadius(doc)
  const dx = doc.spacingX, dy = doc.spacingY * (doc.repeat === 'hex' ? Math.sqrt(3) / 2 : 1)
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
  const w = width / scale, h = height / scale
  const bounds = { x: -w / 2, y: -h / 2, width: w, height: h }
  const copies = instances(doc, bounds, 100000)
  // Style values are constrained to hex colors; never interpolate imported markup.
  for (const color of [doc.fill, doc.stroke, doc.background]) if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Invalid color')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-w / 2} ${-h / 2} ${w} ${h}"><title>Tesselate pattern</title><defs><clipPath id="artboard"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"/></clipPath><path id="motif" d="${pathData(doc.points, doc.smooth)}" fill="${doc.fill}" stroke="${doc.stroke}" stroke-width="${doc.strokeWidth}" stroke-linejoin="round"/></defs><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${doc.background}"/><g clip-path="url(#artboard)">${copies.map(copy => `<use href="#motif" transform="${matrixText(copy.matrix)}"/>`).join('')}</g></svg>`
}

export function validDocument(value: unknown): value is PatternDocument {
  if (!value || typeof value !== 'object') return false
  const d = value as PatternDocument
  return Array.isArray(d.points) && d.points.length >= 3 && d.points.length <= 300 && d.points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 500 && Math.abs(p.y) <= 500)
    && ['grid', 'brick', 'hex', 'radial'].includes(d.repeat)
    && [d.fill, d.stroke, d.background].every(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
    && typeof d.mirror === 'boolean'
    && [[d.smooth, 0, 1], [d.spacingX, 60, 400], [d.spacingY, 60, 400], [d.angle, -180, 180], [d.sectors, 2, 24], [d.strokeWidth, 0, 8]].every(([n, min, max]) => Number.isFinite(n) && n >= min && n <= max)
    && Number.isInteger(d.sectors)
}
