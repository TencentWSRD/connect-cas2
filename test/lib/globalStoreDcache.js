var cache = new Map();

class GlobalStoreDcache {
  get(key) {
    let result = '';
    if (cache.get(key)) {
      result = cache.get(key);
    }
    return Promise.resolve(result);
  }

  remove(key) {
    return Promise.resolve();
  }

  set(key, value) {
    cache.set(key, value);
    return Promise.resolve();
  }

  clear() {
    cache.clear();
  }
}



module.exports = GlobalStoreDcache;

