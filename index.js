var _ = require('lodash');

var validate = require('./lib/validate');
var proxyCallback = require('./lib/proxyCallback');
var authenticate = require('./lib/authenticate');
var slo = require('./lib/slo');
var getProxyTicket = require('./lib/getProxyTicket');
var utils = require('./lib/utils');

var DEFAULT_OPTIONS = {
  debug: false,
  ignore: [],
  match: [],
  servicePrefix: '',
  serverPath: '',
  paths: {
    validate: '/cas/validate',
    serviceValidate: '/cas/serviceValidate',
    proxy: '/cas/proxy',
    login: '/cas/login',
    logout: '/cas/logout',
    proxyCallback: '/cas/proxyCallback'
  },
  redirect: false,
  gateway: false,
  renew: false,
  slo: true,
  fromAjax: {
    header: 'x-client-ajax',
    status: 418
  }
};

function connectCas(options) {
  options = _.merge({}, DEFAULT_OPTIONS, options);

  if (!options.servicePrefix || !options.serverPath) throw new Error('Unexpected options.service or options.serverPath!');

  return function(req, res, next) {
    if (!req.sessionStore) throw new Error('You must setup a session store before you can use CAS client!');
    if (!req.session) throw new Error('Unexpected req.session ' + req.session);

    var pathname = req.path;
    var method = req.method;

    req.getProxyTicket = function(targetService, callback) {
      return getProxyTicket(req, options, targetService, callback);
    };

    if (utils.shouldIgnore(req, options)) return next();

    if (method === 'GET') {
      switch (pathname) {
        case options.paths.validate:
          return validate(req, res, next, options);
        case options.paths.proxyCallback:
          return proxyCallback(req, res, next, options);
        default:
          return authenticate(req, res, next, options);
      }
    } else if (method === 'POST' && pathname === options.paths.validate && options.slo) {
      return slo(req, res, next, options);
    }

    next();
  }
}

module.exports = connectCas;
