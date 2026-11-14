import test from 'node:test'
import assert from 'node:assert/strict'
import { initialDocument, initialShape, transformPoint, inversePoint, rotation, instances, exportSVG, motifRadius, validDocument, migrateDocument, addShape, updateShape, removeShape, translateShape, guideGeometry, guideMatrix, latticeSteps } from '../src/core/geometry.ts'
import { history, reducer } from '../src/core/history.ts'
const viewport = { x: -300, y: -300, width: 600, height: 600 }
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00002, `${a} differs from ${b}`)

test('rotation and reflection invert accurately, including translation', () => {
  for (const reflect of [true, false]) for (const angle of [-180, -47, 0, 92, 180]) {
    const p = { x: -37.12, y: 108.34 }, m = rotation(angle, 300, -200, reflect)
    const recovered = inversePoint(transformPoint(p, m), m)
    near(recovered.x, p.x); near(recovered.y, p.y)
  }
})
test('grid has one source and exact neighbor translation without changing shapes', () => {
  const doc = { ...initialDocument, repeat: 'grid', angle: 45 }
  const copies = instances(doc, viewport)
  assert.equal(copies.filter(c => c.source).length, 1)
  assert.equal(copies.find(c => c.id === '0:1').matrix[4], doc.spacingX)
  assert.deepEqual(doc.shapes, initialDocument.shapes)
})
test('negative staggered rows match positive staggered rows', () => {
  const copies = instances(initialDocument, viewport)
  assert.equal(copies.find(c => c.id === '-1:0').matrix[4], initialDocument.spacingX / 2)
})
test('culling includes offscreen centers and all visible shapes', () => {
  const shape = { ...initialShape, id: 'far', points: [{ x: -450, y: 0 }, { x: 450, y: 0 }, { x: 0, y: 50 }] }
  const doc = addShape({ ...initialDocument, repeat: 'grid' }, shape)
  assert.ok(motifRadius(doc) >= 450)
  assert.ok(instances(doc, { x: 300, y: -50, width: 50, height: 100 }).some(c => c.source))
  assert.throws(() => instances(doc, viewport, 2), /Too many/)
  const hidden = updateShape(doc, 'far', s => ({ ...s, visible: false }))
  assert.ok(motifRadius(hidden) < 200)
})
test('radial repeat uses exact sector count and alternating reflections', () => {
  const copies = instances({ ...initialDocument, repeat: 'radial', sectors: 12, mirror: true }, viewport)
  assert.equal(copies.length, 12)
  const m = copies[1].matrix
  assert.ok(m[0] * m[3] - m[1] * m[2] < 0)
  const edge = { x: 50, y: -Math.sqrt(3) * 50 }
  const a = transformPoint(edge, copies[0].matrix), b = transformPoint(edge, copies[1].matrix)
  near(a.x, b.x); near(a.y, b.y)
})
test('SVG is vector-only, exact dimensions, clipped and uses evaluated transforms', () => {
  const svg = exportSVG(initialDocument, 800, 600, 2)
  assert.match(svg, /width="800" height="600" viewBox="-200 -150 400 300"/)
  assert.match(svg, /clip-path="url\(#artboard\)"/)
  assert.equal((svg.match(/<use /g) || []).length, instances(initialDocument, { x: -200, y: -150, width: 400, height: 300 }).length)
  assert.ok(!svg.includes('<image'))
  assert.throws(() => exportSVG(updateShape(initialDocument, initialShape.id, s => ({ ...s, fill: '"><script>' })), 800, 600), /Invalid pattern/)
  assert.throws(() => exportSVG({ ...initialDocument, spacingX: 0 }, 800, 600), /Invalid pattern/)
  assert.throws(() => exportSVG(initialDocument, Infinity, 600), /dimensions/)
})
test('one multi-shape drag becomes one undo item; unaffected layers retain their geometry', () => {
  const doc = addShape(initialDocument, { ...initialShape, id: 'second', fill: '#112233' })
  let state = history(doc)
  state = reducer(state, { type: 'begin' })
  for (let i = 0; i < 50; i++) state = reducer(state, { type: 'live', update: d => updateShape(d, 'second', s => translateShape(s, { x: 1, y: 0 })) })
  state = reducer(state, { type: 'end' })
  assert.equal(state.past.length, 1)
  assert.deepEqual(state.present.shapes[0], initialShape)
  const edited = state.present
  state = reducer(state, { type: 'undo' }); assert.deepEqual(state.present, doc)
  state = reducer(state, { type: 'redo' }); assert.deepEqual(state.present, edited)
  state = reducer(state, { type: 'begin' })
  state = reducer(state, { type: 'live', update: d => ({ ...d, angle: 80 }) })
  state = reducer(state, { type: 'cancel' }); assert.deepEqual(state.present, edited)
})
test('adding, hiding, styling and removing layers is undoable and isolated', () => {
  let state = history(initialDocument)
  state = reducer(state, { type: 'edit', update: d => addShape(d, { ...initialShape, id: 'second' }) })
  state = reducer(state, { type: 'edit', update: d => updateShape(d, 'second', s => ({ ...s, visible: false, fill: '#112233' })) })
  assert.deepEqual(state.present.shapes[0], initialShape)
  state = reducer(state, { type: 'edit', update: d => removeShape(d, 'second') })
  assert.equal(state.present.shapes.length, 1)
  state = reducer(state, { type: 'undo' }); assert.equal(state.present.shapes[1].visible, false)
  state = reducer(state, { type: 'undo' }); assert.equal(state.present.shapes[1].visible, true)
  assert.equal(removeShape(initialDocument, initialShape.id).shapes.length, 0)
})
test('SVG preserves visible layer stacking and individual styles and omits hidden layers', () => {
  let doc = addShape(initialDocument, { ...initialShape, id: 'second', fill: '#112233', stroke: '#aabbcc', strokeWidth: 2 })
  doc = addShape(doc, { ...initialShape, id: 'hidden', fill: '#998877', visible: false })
  const svg = exportSVG(doc, 500, 500)
  assert.ok(svg.indexOf('#62794c') < svg.indexOf('#112233'))
  assert.match(svg, /fill="#112233" stroke="#aabbcc" stroke-width="2"/)
  assert.ok(!svg.includes('#998877'))
  assert.equal((svg.match(/<path /g) || []).length, 2)
  assert.ok(!svg.includes('geometry-guides'))
})
test('saved documents migrate without losing path, styling, or repeat settings', () => {
  const old = { ...initialDocument, ...initialShape, angle: 33, repeat: 'hex' }
  delete old.shapes; delete old.version; delete old.id; delete old.name; delete old.visible
  const migrated = migrateDocument(old)
  assert.ok(validDocument(migrated))
  assert.deepEqual(migrated.shapes[0].points, initialShape.points)
  assert.equal(migrated.shapes[0].fill, initialShape.fill)
  assert.equal(migrated.angle, 33)
  assert.deepEqual(migrateDocument(migrated), migrated)
})
test('validation rejects invalid shapes, duplicate IDs and invalid configuration', () => {
  assert.ok(validDocument(initialDocument))
  assert.ok(validDocument({ ...initialDocument, shapes: [] }))
  assert.ok(!validDocument({ ...initialDocument, spacingX: 0 }))
  assert.ok(!validDocument({ ...initialDocument, shapes: [initialShape, initialShape] }))
  assert.ok(!validDocument(updateShape(initialDocument, initialShape.id, s => ({ ...s, points: [{ x: NaN, y: 0 }] }))))
  assert.throws(() => addShape(initialDocument, initialShape), /unique/)
})
test('translation clamps uniformly at workspace boundaries without distorting the shape', () => {
  const moved = translateShape(initialShape, { x: 10000, y: 10000 })
  assert.ok(moved.points.every(p => p.x <= 2000 && p.y <= 2000))
  const dx = moved.points[0].x - initialShape.points[0].x
  for (let i = 0; i < moved.points.length; i++) near(moved.points[i].x - initialShape.points[i].x, dx)
})
test('hexagon guides and the lattice share regular hexagon edges even after rotation/reflection', () => {
  const doc = { ...initialDocument, repeat: 'hex', spacingX: 180, spacingY: 300, angle: 51, mirror: true }
  near(latticeSteps(doc).y, 180 * Math.sqrt(3) / 2)
  const guide = guideGeometry(doc)
  assert.equal(guide.label, 'Hexagon cell')
  const r = guide.radius, copies = instances(doc, viewport)
  const origin = copies.find(c => c.source), right = copies.find(c => c.id === '0:1'), down = copies.find(c => c.id === '1:0')
  const matrix = guideMatrix(doc, origin)
  assert.deepEqual(matrix, [1, 0, 0, 1, 0, 0])
  const rightEdge = transformPoint({ x: 90, y: r / 2 }, matrix)
  const leftEdge = transformPoint({ x: -90, y: r / 2 }, guideMatrix(doc, right))
  near(rightEdge.x, leftEdge.x); near(rightEdge.y, leftEdge.y)
  const topOfDown = transformPoint({ x: 0, y: -r }, guideMatrix(doc, down))
  near(topOfDown.x, rightEdge.x); near(topOfDown.y, rightEdge.y)
})
test('guide shape distinguishes rectangular, staggered, hexagon, and radial geometry', () => {
  const paths = ['grid', 'brick', 'hex', 'radial'].map(repeat => guideGeometry({ ...initialDocument, repeat }).path)
  assert.equal(new Set(paths).size, 4)
  assert.ok(!paths[2].includes(' A '))
  assert.ok(paths[3].includes(' A '))
  const radial = { ...initialDocument, repeat: 'radial', angle: 37, mirror: true }
  const copy = instances(radial, viewport)[1]
  assert.deepEqual(guideMatrix(radial, copy), copy.matrix)
})
