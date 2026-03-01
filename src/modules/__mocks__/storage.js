/**
 * Mock storage for tests — in-memory Map-based implementation
 */
const cache = new Map()

export function init() {
  return Promise.resolve()
}

export function get(key) {
  const value = cache.get(key)
  return value !== undefined ? value : null
}

export function set(key, value) {
  cache.set(key, value)
}

export function remove(key) {
  cache.delete(key)
}

export function flush() {
  return Promise.resolve()
}

export function _reset() {
  cache.clear()
}

export default { init, get, set, remove, flush, _reset }
