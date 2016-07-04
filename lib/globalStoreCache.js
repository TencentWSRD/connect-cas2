var store = {};

function get(key) {
  return store[key];
}

function set(key, value) {
  store[key] = value;
}

function contains(key) {
  return !!store[key];
}

function clear() {
  store = {};
}

function getAll() {
  return store;
}

module.exports = {
  getAll: getAll,
  get: get,
  set: set,
  contains: contains,
  clear: clear
};