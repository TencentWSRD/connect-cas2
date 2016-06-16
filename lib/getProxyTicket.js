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
 * @param disableCache (Optional)
 * @param callback
 * @returns {*}
 */
module.exports = function(req, targetService, disableCache, callback) {
  if (typeof disableCache === 'function') {
    callback = disableCache;
    disableCache = false;
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

  /**
   *  请求pt, 返回一个promise, 无法获取或者没pgt则返回401
   */
  // TODO: 增加options.cache targetService 为key, pt为value, 并且实现过期时间, 缓存时存对象,包装更新时间, 取得时候判断是否过期
  // if (req.pt && req.pt[options.targetService]) {
  //   return next();
  // }

  var proxyPath = utils.getPath('proxy', options) + '?' + queryString.stringify(params);

  var isMatchFilter = options.cache.filter.some(function(rule) {
    return utils.isMatchRule(req, targetService, rule);
  });

  if (isMatchFilter && debug) {
    console.log('Matched filer rules, ignore cache');
  }

  if (disableCache || !options.cache.enable || isMatchFilter) {
    if (debug) {
      console.log('request pt', proxyPath);
      if (disableCache) {
        console.log('Enforce request pt, ignore cache');
      }
    }
    requestPT(proxyPath, function(err, pt) {
      if (err) return callback(err);
      callback(null, pt);
    })
  } else {
    ptStroe.get(req, targetService, function(err, pt) {
      if (err) return callback(err);
      if (pt) return callback(null, pt);

      if (debug) {
        console.log('request pt', proxyPath);
      }
      requestPT(proxyPath, function(err, pt) {
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
      });
    });
  }
};

