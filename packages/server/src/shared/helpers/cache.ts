import NodeCache from 'node-cache';

export function getCacheInstance(options?: NodeCache.Options) {
  const instance = new NodeCache(options);

  return {
    get: instance.get.bind(instance),
    set: instance.set.bind(instance),
    delete: instance.del.bind(instance),
    clear: instance.flushAll.bind(instance),
  };
}
