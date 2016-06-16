var VALUE = 'v';
var UPDATE_TIME = 't';

/**
 *
 * @param options
 * @constructor
 */
function PTStore(options) {
  this.options = options || {};
}

PTStore.prototype.set = function(req, key, value, callback) {
  var debug = !!this.options.debug;
  if (!req.session.ptStorage) req.session.ptStorage = {};

  // If this key exist, overwrite directly
  req.session.ptStorage[key] = {};
  req.session.ptStorage[key][VALUE] = value;
  req.session.ptStorage[key][UPDATE_TIME] = Date.now();

  req.session.save(function(err) {
    if (err) {
      console.error('Error when trying to cache pt in session.');
      console.error(err);
      return callback(err);
    }

    if (debug) {
      console.log('Store pt for cache succeed, service: ' + key + ', pt: ' + value);
    }

    callback();
  });
};

PTStore.prototype.get = function(req, key, callback) {
  var debug = !!this.options.debug;
  if (!req.session.ptStorage) req.session.ptStorage = {};

  var ptData = req.session.ptStorage[key];
  if (ptData) {
    var updateTime = ptData[UPDATE_TIME];
    var value = ptData[VALUE];

    if (debug) {
      console.log('Find PT from cache', ptData);
      console.log('Current ttl is ' + this.options.ttl + ', start checking validation.');
    }

    if (Date.now() - updateTime > this.options.ttl) {
      if (debug) {
        console.log('Find PT from cache, but it is expired!');
      }

      return this.remove(req, key, callback);
    }

    if (debug) {
      console.log('Find PT from cache for service: ' + key + ', pt: ' + value);
    }

    // PT still valid
    callback(null, value);
  } else {
    callback(null);
  }
};

PTStore.prototype.remove = function(req, key, callback) {
  var debug = !!this.options.debug;

  if (!req.session.ptStorage) req.session.ptStorage = {};
  if (!req.session.ptStorage[key]) {
    if (debug) {
      console.log('Trying to remove PT for service: ' + key + ', but it don\' exist!');
    }
    return callback(null);
  }

  delete req.session.ptStorage[key];
  req.session.save(function(err) {
    if (err) {
      console.error('Error when deleting pt');
      console.error(err);
      return callback(err);
    }

    if (debug) {
      console.log('Delete PT from cache succeed!');
    }
    callback(null);
  });
};

PTStore.prototype.clear = function(req, callback) {
  if (!req.session.ptStorage) return callback(null);

  req.session.ptStorage = {};
  req.session.save(function(err) {
    if (err) return callback(err);
    callback(null);
  });
};

module.exports = PTStore;