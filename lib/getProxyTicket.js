var utils = require('./utils');
var queryString = require('query-string');

function requestPT(req, path, logger, callback) {
  utils.getRequest(path, function(err, response) {
    if (err) {
      logger.error('Error happened when sending request to: ' + proxyPath);
      logger.error(err);
      return callback(err);
    }

    if (response.status !== 200) {
      return callback(response);
    }

    var pt = '';
    if (/<cas:proxySuccess/.exec(response.body)) {
      if (/<cas:proxyTicket>(.*)<\/cas:proxyTicket>/.exec(response.body)) {
        pt = RegExp.$1;
      }
    }

    if (pt) {
      callback(null, pt);
    } else {
      logger.error('can\' get pt from XML.');
      return callback(new Error('Not a valid CAS XML response: ' + response.body));
    }
  });
}

/**
 * Get a proxy ticket from CAS server.
 *
 * @context {ConnectCas}
 * @param req
 * @param targetService
 * @param ptOptions (Optional) ptOptions can be either Function/Object/Boolean
 * @param ptOptions.disableCache {Boolean}
 * @param ptOptions.renew {Boolean}
 * @param logger
 * @param callback
 * @param {String} specialPgt
 * @returns {*}
 */
module.exports = function(req, targetService, ptOptions, logger, callback, specialPgt) {
  var retryHandler;

  if (typeof ptOptions === 'function') {
    // when both of them are functions, then ptOptions is the real callback, the param callback is the retry handler callback
    if (typeof callback === 'function') {
      logger.info('RetryHandler is set.');
      retryHandler = callback;
    }
    callback = ptOptions;
    ptOptions = {
      disableCache: true,
      renew: false
    };
  } else if (ptOptions === false) {
    ptOptions = {
      disableCache: false,
      renew: false
    };
  } else if (ptOptions === true) {
    ptOptions = {
      disableCache: true,
      renew: false
    };
  } else {
    ptOptions = {
      disableCache: true,
      renew: false
    }
  }

  var options = this.options;
  var debug = !!options.debug;
  var ptStore = this.ptStore;

  if (!targetService) {
    return callback(new Error('Unexpected targetService of ' + targetService + ', a String is expired.'));
  }

  var pgt = specialPgt || (req.session && req.session.pgt);

  if (specialPgt) {
    logger.info('specialPgt is set, use specialPgt: ', specialPgt);
  }

  if (!pgt) {
    return callback(new Error('Unexpected pgt of ' + pgt + ', a String is expired.'));
  }


  var params = {};
  params.targetService = targetService;
  params.pgt = pgt;

  var proxyPath = utils.getPath('proxy', options) + '?' + queryString.stringify(params);

  var isMatchFilter = options.cache.filter.some(function(rule) {
    return utils.isMatchRule(req, targetService, rule);
  });

  if (isMatchFilter) {
    logger.info('Matched filer rules, ignore cache');
  }

  logger.info('ptOptions', ptOptions);

  if (ptOptions.disableCache || !options.cache.enable || isMatchFilter) {
    if (debug) {
      logger.info('request pt', proxyPath);
      if (ptOptions.disableCache) {
        logger.info('Enforce request pt, ignore cache');
      }
    }
    requestPT(req, proxyPath, logger, function(err, pt) {
      if (err) return retryHandler ? retryHandler(err) : callback(err);
      callback(null, pt);
    });
  }
  // reset PT in ptStore, then request a new one
  else if (ptOptions.renew) {
    ptStore.remove(req, logger, targetService, function(err) {
      if (err) return callback(err);

      logger.info('request pt', proxyPath);
      requestPT(req, proxyPath, logger, getPtHandler);
    });
  } else {
    ptStore.get(req, logger, targetService, function(err, pt) {
      if (err) return callback(err);
      if (pt) return callback(null, pt);

      logger.info('request pt', proxyPath);
      requestPT(req, proxyPath, logger, getPtHandler);
    });
  }

  function getPtHandler(err, pt) {
    if (err) {
      if (typeof retryHandler === 'function') {
        return retryHandler(err);
      }
      logger.error('Error happened when sending request to: ' + proxyPath);
      if (debug) {
        logger.error(err);
      }
      return callback(err);
    }

    ptStore.set(req, logger, targetService, pt, function(err) {
      if (err) return callback(err);
      callback(null, pt);
    });
  }
};
