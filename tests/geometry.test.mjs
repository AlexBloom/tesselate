import test from 'node:test'
import assert from 'node:assert/strict'
import { initialDocument, transformPoint, inversePoint, rotation, instances, exportSVG, motifRadius, validDocument } from '../src/core/geometry.ts'
import { history, reducer } from '../src/core/history.ts'

test('rotation and reflection invert accurately, including translation', () => {
  for (const reflect of [true, false]) for (const angle of [-180, -47, 0, 92, 180]) {
    const p = { x: -37.12, y: 108.34 }, m = rotation(angle, 300, -200, reflect)
    const recovered = inversePoint(transformPoint(p, m), m)
    assert.ok(Math.abs(recovered.x - p.x) < 1e-9 && Math.abs(recovered.y - p.y) < 1e-9)
  }
})
test('grid has one source and exact requested neighbor translation', () => {
  const doc = { ...initialDocument, repeat: 'grid', angle: 45 }
  const copies = instances(doc, { x: -200, y: -200, width: 400, height: 400 })
  assert.equal(copies.filter(c => c.source).length, 1)
  assert.equal(copies.find(c => c.id === '0:1').matrix[4], doc.spacingX)
  assert.deepEqual(doc.points, initialDocument.points)
})
test('negative staggered rows match positive staggered rows', () => {
  const copies = instances(initialDocument, { x: -300, y: -300, width: 600, height: 600 })
  assert.equal(copies.find(c => c.id === '-1:0').matrix[4], initialDocument.spacingX / 2)
})
test('culling includes motifs whose centers are outside the viewport', () => {
  const doc = { ...initialDocument, repeat: 'grid', points: [{ x: -450, y: 0 }, { x: 450, y: 0 }, { x: 0, y: 50 }] }
  assert.ok(motifRadius(doc) >= 450)
  assert.ok(instances(doc, { x: 300, y: -50, width: 50, height: 100 }).some(c => c.source))
  assert.throws(() => instances(doc, { x: -500, y: -500, width: 1000, height: 1000 }, 2), /Too many/)
})
test('radial repeat uses exact sector count and alternating reflections', () => {
  const copies = instances({ ...initialDocument, repeat: 'radial', sectors: 12, mirror: true }, { x: 0, y: 0, width: 100, height: 100 })
  assert.equal(copies.length, 12)
  const m = copies[1].matrix
  assert.ok(m[0] * m[3] - m[1] * m[2] < 0)
})
test('SVG is vector-only, exact dimensions and uses all evaluated transforms', () => {
  const svg = exportSVG(initialDocument, 800, 600, 2)
  assert.match(svg, /width="800" height="600" viewBox="-200 -150 400 300"/)
  assert.equal((svg.match(/<use /g) || []).length, instances(initialDocument, { x: -200, y: -150, width: 400, height: 300 }).length)
  assert.ok(!svg.includes('<image'))
  assert.throws(() => exportSVG({ ...initialDocument, fill: '"><script>' }, 800, 600), /Invalid color/)
  assert.throws(() => exportSVG(initialDocument, Infinity, 600), /dimensions/)
})
test('one drag becomes one undo item and undo/redo preserves geometry and settings', () => {
  let state = history(initialDocument)
  state = reducer(state, { type: 'begin' })
  for (let i = 0; i < 50; i++) state = reducer(state, { type: 'live', update: d => ({ ...d, spacingX: 200 + i }) })
  state = reducer(state, { type: 'end' })
  assert.equal(state.past.length, 1)
  const edited = state.present
  state = reducer(state, { type: 'undo' })
  assert.deepEqual(state.present, initialDocument)
  state = reducer(state, { type: 'redo' })
  assert.deepEqual(state.present, edited)
  state = reducer(state, { type: 'begin' })
  state = reducer(state, { type: 'live', update: d => ({ ...d, angle: 80 }) })
  state = reducer(state, { type: 'cancel' })
  assert.deepEqual(state.present, edited)
})
test('saved document validation rejects invalid geometry and configuration', () => {
  assert.ok(validDocument(initialDocument))
  assert.ok(!validDocument({ ...initialDocument, spacingX: 0 }))
  assert.ok(!validDocument({ ...initialDocument, points: [{ x: NaN, y: 0 }] }))
})

 test('reflected radial sectors meet at the shared wedge boundary', () => {
  const copies = instances({ ...initialDocument, repeat: 'radial', sectors: 12, mirror: true }, { x: -200, y: -200, width: 400, height: 400 })
  const edge = { x: 50, y: -Math.sqrt(3) * 50 }
  const a = transformPoint(edge, copies[0].matrix), b = transformPoint(edge, copies[1].matrix)
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9)
})
