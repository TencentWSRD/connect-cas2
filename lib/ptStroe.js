var _ = require('lodash');
var utils = require('./utils');

var VALUE = 'v';
var UPDATE_TIME = 't';

var DEFAULT_OPTIONS = {
  ttl: 5 * 60 * 1000, // In millisecond
};

/**
 *
 * @param options
 * @param {Number}   options.ttl    缓存时间
 * @param {Function} options.logger (Optional)
 * @constructor
 */
function PTStore(options) {
  this.options = _.merge(DEFAULT_OPTIONS, options);
}

PTStore.prototype.set = function(req, key, value, callback) {
  var logger = utils.getLogger(req, this.options);
  if (!req.session.ptStorage) req.session.ptStorage = {};

  // If this key exist, overwrite directly
  req.session.ptStorage[key] = {};
  req.session.ptStorage[key][VALUE] = value;
  req.session.ptStorage[key][UPDATE_TIME] = Date.now();

  req.session.save(function(err) {
    if (err) {
      logger.error('Error when trying to cache pt in session.');
      logger.error(err);
      return callback(err);
    }

    logger.info('Store pt for cache succeed, service: ' + key + ', pt: ' + value);

    callback();
  });
};

PTStore.prototype.get = function(req, key, callback) {
  var logger = utils.getLogger(req, this.options);
  if (!req.session.ptStorage) req.session.ptStorage = {};

  var ptData = req.session.ptStorage[key];
  if (ptData) {
    var updateTime = ptData[UPDATE_TIME];
    var value = ptData[VALUE];

    logger.info('Find PT from cache', ptData);
    logger.info('Current ttl is ' + this.options.ttl + ', start checking validation.');

    if (Date.now() - updateTime > this.options.ttl) {
      logger.info('Find PT from cache, but it is expired!');

      return this.remove(req, key, callback);
    }

    logger.info('Find PT from cache for service: ' + key + ', pt: ' + value);

    // PT still valid
    callback(null, value);
  } else {
    callback(null);
  }
};

PTStore.prototype.remove = function(req, key, callback) {
  var logger = utils.getLogger(req, this.options);
  if (!req.session.ptStorage) req.session.ptStorage = {};
  if (!req.session.ptStorage[key]) {
    logger.info('Trying to remove PT for service: ' + key + ', but it don\' exist!');
    return callback(null);
  }

  delete req.session.ptStorage[key];
  req.session.save(function(err) {
    if (err) {
      logger.error('Error when deleting pt');
      logger.error(err);
      return callback(err);
    }

    logger.info('Delete PT from cache succeed!');
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