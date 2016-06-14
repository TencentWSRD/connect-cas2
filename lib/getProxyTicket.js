var utils = require('./utils');
var queryString = require('query-string');

/**
 * Get a proxy ticket from CAS server.
 *
 * @param req
 * @param options
 * @param targetService
 * @param callback
 * @returns {*}
 */
module.exports = function(req, options, targetService, callback) {
  var debug = !!options.debug;
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
  // ticket复用，暂不提供实现
  // if (req.pt && req.pt[options.targetService]) {
  //   return next();
  // }

  var proxyPath = options.serverPath + options.paths.proxy + '?' + queryString.stringify(params);

  if (debug) {
    console.log('request pt', proxyPath);
  }

  utils.getRequest(proxyPath, function(err, response) {
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
};