var _ = require('lodash');

var validate = require('./lib/validate');
var proxyCallback = require('./lib/proxyCallback');
var authenticate = require('./lib/authenticate');
var slo = require('./lib/slo');
var getProxyTicket = require('./lib/getProxyTicket');
var PTStroe = require('./lib/PTStroe');
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
  // Is proxy-ticket cacheable
  cache: {
    enable: false,
    ttl: 5 * 60, // In millisecond
    filter: []
  },
  fromAjax: {
    header: 'x-client-ajax',
    status: 418
  }
};

function ConnectCas(options) {
  if (!(this instanceof ConnectCas)) return new ConnectCas(options);

  this.options = _.merge({}, DEFAULT_OPTIONS, options);

  if (!this.options.servicePrefix || !this.options.serverPath) throw new Error('Unexpected options.service or options.serverPath!');

  this.ptStore = new PTStroe(_.merge({}, this.options.cache, { debug: this.options.debug }));

  this.logger = this.LoggerFactory.call(this);
}

ConnectCas.prototype.LoggerFactory = function() {
  var debug = this.options && this.options.debug,
    logMethod = this.options && this.options.logger || console,
    info = function() {
      if (debug) logMethod['info'].apply(logMethod['info'], utils.toArray(arguments));
    },
    warn = function() {
      logMethod['warn'].apply(logMethod['info'], utils.toArray(arguments));
    },
    error = function() {
      logMethod['error'].apply(logMethod['info'], utils.toArray(arguments));
    };

  ['info', 'warn', 'error'].forEach(function(type) {
    if (typeof logMethod[type] !== 'function') throw new Error('this.options.logger.' + type + ' is not a function! Is ' + typeof logMethod[type] + ' instead.');
  });
  
  return {
    log: info,
    debug: info,
    info: info,
    warn: warn,
    error: error
  }
};

ConnectCas.prototype.core = function() {
  var options = this.options;
  var that = this;

  return function(req, res, next) {
    if (!req.sessionStore) throw new Error('You must setup a session store before you can use CAS client!');
    if (!req.session) throw new Error('Unexpected req.session ' + req.session);

    var pathname = req.path;
    var method = req.method;

    if (options.paths.proxyCallback) {
      req.getProxyTicket = function(targetService, disableCache, callback) {
        return getProxyTicket.call(that, req, targetService, disableCache, that.logger, callback);
      };
    }

    if (utils.shouldIgnore(req, options)) return next();

    if (method === 'GET') {
      switch (pathname) {
        case options.paths.validate:
          return validate(req, res, next, options, that.logger);
        case options.paths.proxyCallback:
          return proxyCallback(req, res, next, options, that.logger);
        default:
          return authenticate(req, res, next, options, that.logger);
      }
    } else if (method === 'POST' && pathname === options.paths.validate && options.slo) {
      return slo(req, res, next, options);
    }

    next();
  };
};

ConnectCas.prototype.logout = function() {
  var options = this.options;

  return function(req, res, next) {
    if (!req.session) {
      return res.redirect('/');
    }
    // Forget our own login session

    if (req.session.destroy) {
      req.session.destroy();
    } else {
      // Cookie-based sessions have no destroy()
      req.session = null;
    }

    // Send the user to the official campus-wide logout URL
    return res.redirect(utils.getPath('logout', options));
  };
};

ConnectCas.prototype.getPath = function(name) {
  return utils.getPath(name, this.options);
};

module.exports = ConnectCas;
