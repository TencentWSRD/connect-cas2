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

PTStore.prototype.set = function(req, logger, key, value, callback) {
  var debug = !!this.options.debug;
  if (!req.session.ptStorage) req.session.ptStorage = {};

  // If this key exist, overwrite directly
  req.session.ptStorage[key] = {};
  req.session.ptStorage[key][VALUE] = value;
  req.session.ptStorage[key][UPDATE_TIME] = Date.now();

  req.session.save(function(err) {
    if (err) {
      logger.error(req, 'Error when trying to cache pt in session.');
      logger.error(req, err);
      return callback(err);
    }

    logger.info(req, 'Store pt for cache succeed, service: ' + key + ', pt: ' + value);

    callback();
  });
};

PTStore.prototype.get = function(req, logger, key, callback) {
  var debug = !!this.options.debug;
  if (!req.session.ptStorage) req.session.ptStorage = {};

  var ptData = req.session.ptStorage[key];
  if (ptData) {
    var updateTime = ptData[UPDATE_TIME];
    var value = ptData[VALUE];

    logger.info(req, 'Find PT from cache', ptData);
    logger.info(req, 'Current ttl is ' + this.options.ttl + ', start checking validation.');

    if (Date.now() - updateTime > this.options.ttl) {
      logger.info(req, 'Find PT from cache, but it is expired!');

      return this.remove(req, key, callback);
    }

    logger.info(req, 'Find PT from cache for service: ' + key + ', pt: ' + value);

    // PT still valid
    callback(null, value);
  } else {
    callback(null);
  }
};

PTStore.prototype.remove = function(req, logger, key, callback) {
  var debug = !!this.options.debug;

  if (!req.session.ptStorage) req.session.ptStorage = {};
  if (!req.session.ptStorage[key]) {
    logger.info(req, 'Trying to remove PT for service: ' + key + ', but it don\' exist!');
    return callback(null);
  }

  delete req.session.ptStorage[key];
  req.session.save(function(err) {
    if (err) {
      logger.error(req, 'Error when deleting pt');
      logger.error(req, err);
      return callback(err);
    }

    logger.info(req, 'Delete PT from cache succeed!');
    callback(null);
  });
};

PTStore.prototype.clear = function(req, logger, callback) {
  if (!req.session.ptStorage) return callback(null);

  req.session.ptStorage = {};
  req.session.save(function(err) {
    if (err) return callback(err);
    callback(null);
  });
};

module.exports = PTStore;