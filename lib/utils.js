var qs = require('query-string');
var url = require('url');
var http = require('http');

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
      return isMatchRule(req, req.pathname, rule);
    });

    if (hasMatch) return false;
  }

  if (options.ignore && options.ignore.splice) {
    var hasMatchIgnore = options.ignore.some(function(rule) {
      return isMatchRule(req, req.pathname, rule);
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

  var req = http.request(options, function(res) {
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

module.exports = {
  getLastUrl: getLastUrl,
  getOrigin: getOrigin,
  shouldIgnore: shouldIgnore,
  getRequest: getRequest,
};