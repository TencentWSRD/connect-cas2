var utils = require('./utils');
var queryString = require('query-string');

function requestPT(path, callback) {
  utils.getRequest(path, function(err, response) {
    if (err) {
      console.error('Error happened when sending request to: ' + proxyPath);
      if (debug) {
        console.error(err);
      }
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
      console.error('can\' get pt from XML.');
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
 * @param callback
 * @returns {*}
 */
module.exports = function(req, targetService, ptOptions, callback) {
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
  var ptStroe = this.ptStore;

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

  if (isMatchFilter && debug) {
    console.log('Matched filer rules, ignore cache');
  }

  if (ptOptions.disableCache || !options.cache.enable || isMatchFilter) {
    if (debug) {
      console.log('request pt', proxyPath);
      if (ptOptions.disableCache) {
        console.log('Enforce request pt, ignore cache');
      }
    }
    requestPT(proxyPath, function(err, pt) {
      if (err) return callback(err);
      callback(null, pt);
    })
  }
  // reset PT in ptStroe, then request a new one
  else if (ptOptions.renew) {
    ptStroe.remove(req, targetService, function(err) {
      if (err) return callback(err);

      if (debug) {
        console.log('request pt', proxyPath);
      }
      requestPT(proxyPath, getPtHandler);
    });
  } else {
    ptStroe.get(req, targetService, function(err, pt) {
      if (err) return callback(err);
      if (pt) return callback(null, pt);

      if (debug) {
        console.log('request pt', proxyPath);
      }
      requestPT(proxyPath, getPtHandler);
    });
  }

  function getPtHandler(err, pt) {
    if (err) {
      console.error('Error happened when sending request to: ' + proxyPath);
      if (debug) {
        console.error(err);
      }
      return callback(err);
    }

    ptStroe.set(req, targetService, pt, function(err) {
      if (err) return callback(err);
      callback(null, pt);
    });
  }
};
