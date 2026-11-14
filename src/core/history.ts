import type { PatternDocument } from './geometry.ts'
export type History = { past: PatternDocument[]; present: PatternDocument; future: PatternDocument[]; gesture: PatternDocument | null }
export type Action = { type: 'edit' | 'live'; update: (doc: PatternDocument) => PatternDocument } | { type: 'begin' | 'end' | 'cancel' | 'undo' | 'redo' }
const same = (a: PatternDocument, b: PatternDocument) => JSON.stringify(a) === JSON.stringify(b)
export function history(doc: PatternDocument): History { return { past: [], present: doc, future: [], gesture: null } }
export function reducer(state: History, action: Action): History {
  switch (action.type) {
    case 'begin': return state.gesture ? state : { ...state, gesture: state.present }
    case 'cancel': return { ...state, present: state.gesture ?? state.present, gesture: null }
    case 'end': return !state.gesture ? state : same(state.present, state.gesture) ? { ...state, gesture: null } : { ...state, past: [...state.past.slice(-99), state.gesture], future: [], gesture: null }
    case 'undo': {
      if (state.gesture) return { ...state, present: state.gesture, gesture: null }
      const previous = state.past.at(-1)
      return !previous ? state : { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], gesture: null }
    }
    case 'redo': return !state.future.length || state.gesture ? state : { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1), gesture: null }
    case 'live': return { ...state, present: action.update(state.present) }
    case 'edit': {
      const next = action.update(state.present)
      return same(next, state.present) ? state : { past: [...state.past.slice(-99), state.gesture ?? state.present], present: next, future: [], gesture: null }
    }
  }
}
