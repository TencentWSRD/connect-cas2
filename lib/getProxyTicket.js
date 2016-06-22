var utils = require('./utils');
var queryString = require('query-string');

function requestPT(req, path, logger, callback) {
  utils.getRequest(path, function(err, response) {
    if (err) {
      logger.error(req, 'Error happened when sending request to: ' + proxyPath);
      logger.error(req, err);
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
      logger.error(req, 'can\' get pt from XML.');
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
 * @param ptOptions (Optional)
 * @param ptOptions.disableCache {Boolean}
 * @param ptOptions.renew {Boolean}
 * @param logger
 * @param callback
 * @returns {*}
 */
module.exports = function(req, targetService, ptOptions, logger, callback) {
  if (typeof ptOptions === 'function') {
    callback = ptOptions;
    ptOptions = {
      disableCache: false,
      renew: false
    };
  } else if (!ptOptions) {
    ptOptions = {
      disableCache: false,
      renew: false
    };
  }

  var options = this.options;
  var debug = !!options.debug;
  var ptStore = this.ptStore;

  if (!targetService) {
    return callback(new Error('Unexpected targetService of ' + targetService + ', a String is expired.'));
  }

  var pgt = req.session && req.session.pgt;

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
    logger.info(req, 'Matched filer rules, ignore cache');
  }

  if (ptOptions.disableCache || !options.cache.enable || isMatchFilter) {
    if (debug) {
      logger.info(req, 'request pt', proxyPath);
      if (ptOptions.disableCache) {
        logger.info(req, 'Enforce request pt, ignore cache');
      }
    }
    requestPT(req, proxyPath, logger, function(err, pt) {
      if (err) return callback(err);
      callback(null, pt);
    })
  }
  // reset PT in ptStore, then request a new one
  else if (ptOptions.renew) {
    ptStore.remove(req, logger, targetService, function(err) {
      if (err) return callback(err);

      logger.info(req, 'request pt', proxyPath);
      requestPT(req, proxyPath, logger, getPtHandler);
    });
  } else {
    ptStore.get(req, logger, targetService, function(err, pt) {
      if (err) return callback(err);
      if (pt) return callback(null, pt);

      logger.info(req, 'request pt', proxyPath);
      requestPT(req, proxyPath, logger, getPtHandler);
    });
  }

  function getPtHandler(err, pt) {
    if (err) {
      logger.error(req, 'Error happened when sending request to: ' + proxyPath);
      if (debug) {
        logger.error(req, err);
      }
      return callback(err);
    }

    ptStore.set(req, logger, targetService, pt, function(err) {
      if (err) return callback(err);
      callback(null, pt);
    });
  }
};
