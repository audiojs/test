const methods = ['available', 'version', 'supports', 'run']

export function defineAdapter(adapter) {
  if (!adapter || typeof adapter.id !== 'string' || !adapter.id) throw new TypeError('Adapter id is required')
  for (const method of methods) if (typeof adapter[method] !== 'function') throw new TypeError(`Adapter ${adapter.id} needs ${method}()`)
  return Object.freeze(adapter)
}
