var _ = require('lodash');

var validate = require('./lib/validate');
var proxyCallback = require('./lib/proxyCallback');
var authenticate = require('./lib/authenticate');
var slo = require('./lib/slo');
var getProxyTicket = require('./lib/getProxyTicket');
var getProxyTicketThroughRestletReq = require('./lib/getProxyTicketThroughRestletReq');
var PTStroe = require('./lib/PTStroe');
var utils = require('./lib/utils');
var clearRestletTGTs = require('./lib/clearRestletTGTs');
var url = require('url');
var globalStoreCache = require('./lib/globalStoreCache');

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
    ttl: 5 * 60 * 1000, // In millisecond
    filter: []
  },
  fromAjax: {
    header: 'x-client-ajax',
    status: 418
  },
  // demo:
  // [{
  //   trigger: function(req) {
  //     return false;
  //   },
  //   params: {
  //     username: '',
  //     password: ''
  //   }
  // }]
  restletIntegration: {}
};

function ConnectCas(options) {
  if (!(this instanceof ConnectCas)) return new ConnectCas(options);

  this.options = _.merge({}, DEFAULT_OPTIONS, options);

  if (!this.options.servicePrefix || !this.options.serverPath) throw new Error('Unexpected options.service or options.serverPath!');

  this.ptStore = new PTStroe(_.merge({}, this.options.cache, { debug: this.options.debug }));

  this.logger = this.options.logger || function(req, type) {
      return console[type].bind(console[type]);
    };

  var pgtURI = url.parse(this.options.paths.proxyCallback);

  this.proxyCallbackPathName = (pgtURI.protocol && pgtURI.host) ? pgtURI.pathname : this.options.paths.proxyCallback;
}

ConnectCas.prototype.LoggerFactory = function() {
};

ConnectCas.prototype.core = function() {
  var options = this.options;
  var that = this;

  return function(req, res, next) {
    if (!req.sessionStore) throw new Error('You must setup a session store before you can use CAS client!');
    if (!req.session) throw new Error('Unexpected req.session ' + req.session);

    var pathname = req.path;
    var method = req.method;

    var logger = {
      info: that.logger(req, 'log'),
      error: that.logger(req, 'error'),
      warn: that.logger(req, 'warn'),
      log: that.logger(req, 'log')
    };

    if (utils.shouldIgnore(req, options)) return next();

    var matchedRestletIntegrateRule;

    if (options.restletIntegration) {
      if (options.paths.restletIntegration) {
        for (var i in options.restletIntegration) {
          if (options.restletIntegration[i] && typeof options.restletIntegration[i].trigger === 'function' && options.restletIntegration[i].trigger(req)) {
            matchedRestletIntegrateRule = i;
            req.clearRestlet = clearRestletTGTs.bind(null, options, logger);
            break;
          }
        }
      } else {
        logger.warn("options.restletIntegration is set, but options.paths.restletIntegration is undefined! Maybe you forget to set all your paths.")
      }
    }

    if (options.paths.proxyCallback) {
      req.getProxyTicket = function(targetService, disableCache, callback) {
        return matchedRestletIntegrateRule ? getProxyTicketThroughRestletReq.call(that, req, targetService, matchedRestletIntegrateRule, options.restletIntegration[matchedRestletIntegrateRule], logger, typeof disableCache === 'function' ? disableCache : callback) :
          getProxyTicket.call(that, req, targetService, disableCache, logger, callback);
      };
    }

    if (matchedRestletIntegrateRule) return next();

    if (method === 'GET') {
      switch (pathname) {
        case options.paths.validate:
          return validate(req, res, next, options, logger);
        case that.proxyCallbackPathName:
          return proxyCallback(req, res, next, options, logger);
        default:
          return authenticate(req, res, next, options, logger);
      }
    } else if (method === 'POST' && pathname === options.paths.validate && options.slo) {
      return slo(req, res, next, options, logger);
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

ConnectCas.prototype.getPath = function(name, req) {
  return utils.getPath(name, this.options, req);
};

ConnectCas.prototype.destroyRestletIntegrations = function() {
  var stores = globalStoreCache.getAll();

  for (var i in stores) {
    utils.deleteRequest(utils.getPath('restletIntegration') + '/' + stores[i], function(err, response) {
      if (err || !response || response.statusCode != 200 || response.status != 200) return console.error('Error when delete restletIntegartion-created TGT!');
      console.log('Delete restletIntegartion-created TGT succeed!', stores[i]);
    });
  }
};

module.exports = ConnectCas;
