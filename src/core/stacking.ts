import type { PatternDocument } from './geometry'
export type StackTarget = { kind: 'layer' | 'object'; id: string }
export type StackAction = 'forward' | 'backward' | 'front' | 'back'
export function stackItems(doc: PatternDocument, target: StackTarget): string[] {
  if (target.kind === 'layer') return doc.layers.map(l => l.id)
  const object = doc.shapes.find(s => s.id === target.id)
  return object ? doc.shapes.filter(s => s.layerId === object.layerId).map(s => s.id) : []
}
export function canStack(doc: PatternDocument, target: StackTarget, action: StackAction): boolean {
  const ids = stackItems(doc, target), index = ids.indexOf(target.id)
  const object = target.kind === 'object' && doc.shapes.find(s => s.id === target.id)
  if (object && doc.layers.find(l => l.id === object.layerId)?.locked) return false
  return index >= 0 && (action === 'front' || action === 'forward' ? index < ids.length - 1 : index > 0)
}
export function stack(doc: PatternDocument, target: StackTarget, action: StackAction): PatternDocument {
  if (!canStack(doc, target, action)) return doc
  const ids = stackItems(doc, target), index = ids.indexOf(target.id)
  const to = action === 'front' ? ids.length - 1 : action === 'back' ? 0 : index + (action === 'forward' ? 1 : -1)
  ids.splice(index, 1); ids.splice(to, 0, target.id)
  if (target.kind === 'layer') return { ...doc, layers: ids.map(id => doc.layers.find(l => l.id === id)!) }
  const siblings = new Set(ids), reordered = ids.map(id => doc.shapes.find(s => s.id === id)!); let cursor = 0
  return { ...doc, shapes: doc.shapes.map(s => siblings.has(s.id) ? reordered[cursor++] : s) }
}
/** The panel reads front-to-back; above means later in SVG paint order. */
export function dropStack(doc: PatternDocument, source: StackTarget, target: StackTarget, above = true): PatternDocument {
  if (source.id === target.id || (source.kind === 'layer' && target.kind !== 'layer')) return doc
  if (source.kind === 'layer') {
    const item = doc.layers.find(l => l.id === source.id)
    if (!item || !doc.layers.some(l => l.id === target.id)) return doc
    const layers = doc.layers.filter(l => l.id !== item.id)
    layers.splice(layers.findIndex(l => l.id === target.id) + (above ? 1 : 0), 0, item)
    return { ...doc, layers }
  }
  const item = doc.shapes.find(s => s.id === source.id)
  const sibling = target.kind === 'object' ? doc.shapes.find(s => s.id === target.id) : undefined
  const layerId = target.kind === 'layer' ? target.id : sibling?.layerId
  const layer = doc.layers.find(l => l.id === layerId)
  if (!item || !layer || layer.locked || doc.layers.find(l => l.id === item.layerId)?.locked || (target.kind === 'object' && !sibling)) return doc
  const shapes = doc.shapes.filter(s => s.id !== item.id), moved = { ...item, layerId: layer.id }
  const index = sibling ? shapes.findIndex(s => s.id === sibling.id) + (above ? 1 : 0) : shapes.length
  shapes.splice(index, 0, moved)
  return { ...doc, shapes }
}
