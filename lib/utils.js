var qs = require('query-string');
var url = require('url');
var http = require('http');
var https = require('https');

/**
 * Return `true` when pathname match the rule.
 *
 * @param req
 * @param pathname
 * @param rule
 * @returns {*}
 */
function isMatchRule(req, pathname, rule) {
  if (typeof rule === 'string') {
    return pathname.indexOf(rule) > -1;
  } else if (rule instanceof RegExp) {
    return rule.test(pathname);
  } else if (typeof rule === 'function') {
    return rule(pathname, req);
  }
}

/**
 *
 * @param req
 * @param options
 * @returns {string}
 */
function getOrigin(req, options) {
  var query = req.query;
  if (query.ticket) delete query.ticket;
  var querystring = qs.stringify(query);
  if (!options) {
    throw new Error('no options!!!');
  }

  return options.servicePrefix + url.parse(req.originalUrl).pathname + (querystring ? '?' + querystring : '');
}

/**
 * Check options.match first, if match, return `false`, then check the options.ignore, if match, return `true`.
 *
 * If returned `true`, then this request will bypass CAS directly.
 *
 * @param req
 * @param options
 */
function shouldIgnore(req, options) {
  if (options.match && options.match.splice) {
    var hasMatch = options.match.some(function(rule) {
      return isMatchRule(req, req.path, rule);
    });

    if (hasMatch) return false;
  }

  if (options.ignore && options.ignore.splice) {
    var hasMatchIgnore = options.ignore.some(function(rule) {
      return isMatchRule(req, req.path, rule);
    });

    if (hasMatchIgnore) return true;
  }
}

function getLastUrl(req, options) {
  var lastUrl = (req.session && req.session.lastUrl) ? req.session.lastUrl : '/';

  var uri = url.parse(lastUrl);

  if (uri.pathname === options.paths.validate) lastUrl = '/';

  if (options.debug) {
    console.log('Get lastUrl: ' + lastUrl);
  }
  return lastUrl;
}

/**
 * Send a GET request
 *
 * @param path
 * @param callback
 */
function getRequest(path, callback) {
  var options = url.parse(path);
  options.method = 'GET';

  var chunks = [];

  var req = (options.protocol === 'https:' ? https : http )['request'](options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      chunks.push(chunk);
    });
    res.on('end', function() {
      callback(null, {
        status: res.statusCode,
        body: chunks.join(''),
        header: res.headers
      });
    });
  });

  req.on('error', function(e) {
    callback(e);
  });

  req.end();
}

function getPath(name, options) {
  var path = '';

  switch (name) {
    case 'login':
      path = options.serverPath + options.paths.login + '?service=' + encodeURIComponent(options.servicePrefix + options.paths.validate);
      break;
    case 'logout':
      path = options.serverPath + options.paths.logout + '?service=' + encodeURIComponent(options.servicePrefix + options.paths.validate);
      break;
    case 'pgtUrl':
      var proxyCallbackUri = url.parse(options.paths.proxyCallback);
      path = (proxyCallbackUri.protocol && proxyCallbackUri.host) ? (options.paths.proxyCallback) : (options.servicePrefix + options.paths.proxyCallback);
      break;
    case 'serviceValidate':
      path = options.serverPath + options.paths.serviceValidate;
      break;
    case 'proxy':
      path = options.serverPath + options.paths.proxy;
      break;
    case 'service':
    case 'validate':
      path = options.servicePrefix + options.paths.validate;
      break;
  }
  return path;
}

function toArray(arrayLike) {
  return Array.prototype.slice.call(arrayLike);
}

module.exports = {
  toArray: toArray,
  getLastUrl: getLastUrl,
  getOrigin: getOrigin,
  shouldIgnore: shouldIgnore,
  getRequest: getRequest,
  getPath: getPath,
  isMatchRule: isMatchRule
};