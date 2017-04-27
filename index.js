var _ = require('lodash');

var validate = require('./lib/validate');
var proxyCallback = require('./lib/proxyCallback');
var authenticate = require('./lib/authenticate');
var slo = require('./lib/slo');
var getProxyTicket = require('./lib/getProxyTicket');
var getProxyTicketThroughRestletReq = require('./lib/getProxyTicketThroughRestletReq').getProxyTicketThroughRestletReq;
var getProxyTicketThroughRestletReqDcache = require('./lib/getProxyTicketThroughRestletReq').getProxyTicketThroughRestletReqDcache;
var PTStroe = require('./lib/ptStroe');
var utils = require('./lib/utils');
var clearRestletTGTs = require('./lib/clearRestletTGTs');
var url = require('url');
var deprecate = require('deprecate');

var DEFAULT_OPTIONS = {
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
  hooks: {
    before: null,
    after: null
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
  restletIntegration: {},
  restletIntegrationIsUsingCache: true
};

function ConnectCas(options) {
  /* istanbul ignore if */
  if (!(this instanceof ConnectCas)) return new ConnectCas(options);

  this.options = _.merge({}, DEFAULT_OPTIONS, options);

  /* istanbul ignore if */
  if (this.options.ssoff) {
    deprecate('options.ssoff is deprecated, use option.slo instead.');
    this.options.slo = this.options.ssoff;
  }

  if (this.options.debug) {
    deprecate('options.debug is deprecated, please control the console output by a custom logger.');
  }

  /* istanbul ignore if */
  if (!this.options.servicePrefix || !this.options.serverPath) throw new Error('Unexpected options.service or options.serverPath!');

  if (this.options.cache && this.options.cache.enable) {
    this.ptStore = new PTStroe({
      ttl: this.options.cache.ttl,
      logger: this.options.logger
    });
  }

  if (this.options.renew || this.options.gateway) {
    console.warn('options.renew and options.gateway is not implement yet!');
  }

  var pgtURI = url.parse(this.options.paths.proxyCallback || '', true);

  this.proxyCallbackPathName = (pgtURI.protocol && pgtURI.host) ? pgtURI.pathname : this.options.paths.proxyCallback;
}

ConnectCas.prototype.core = function() {
  var options = this.options;
  var that = this;

  if (options.hooks && typeof options.hooks.before === 'function') {
    return function(req, res, next) {
      options.hooks.before(req, res, function() {
        coreMiddleware(req, res, next);
      });
    }
  } else {
    return coreMiddleware;
  }

  function coreMiddleware(req, res, next) {
    if (!req.sessionStore) throw new Error('You must setup a session store before you can use CAS client!');
    if (!req.session) throw new Error('Unexpected req.session ' + req.session);

    var logger = utils.getLogger(req, options);
    var pathname = req.path;
    var method = req.method;

    var matchedRestletIntegrateRule;

    if (options.restletIntegration) {
      if (options.paths.restletIntegration) {
        req.clearRestlet = clearRestletTGTs.bind(null, options, logger);

        for (var i in options.restletIntegration) {
          if (options.restletIntegration[i] && typeof options.restletIntegration[i].trigger === 'function' && options.restletIntegration[i].trigger(req)) {
            matchedRestletIntegrateRule = i;
            break;
          }
        }
      } else {
        logger.warn("options.restletIntegration is set, but options.paths.restletIntegration is undefined! Maybe you forget to set all your paths.")
      }
    }

    /**
     *
     * @param {String}     targetService  (Required) targetService for this proxy ticket
     * @param {Object}    [proxyOptions] (Optional) If this option is true, will force to request a new proxy ticket, ignore the cahce.
     *                                              Otherwise, whether to use cache or not depending on the options.cache.enable
     * @param {String}    proxyOptions.targetService   (Required)
     * @param {Boolean}   proxyOptions.disableCache    Whether to force disable cache and to request a new one.
     * @param {String}    proxyOptions.specialPgt      Use this pgt to request a PT, instead of req.session.cas.pgt
     * @param {Boolean}   proxyOptions.renew           Don't use cache, request a new one, reset it to cache
     * @param {Function}  proxyOptions.retryHandler    When trying to fetch a PT failed due to authentication issue, this callback will be called, it will receive one param `error`, which introduce the fail reason.
     *                                                 Be careful when you setting up this option because it might occur an retry loop.
     * @param {Function}  callback
     * @returns {*}
     */
    req.getProxyTicket = function(targetService, proxyOptions, callback) {

      if (typeof proxyOptions === 'function') {
        callback = proxyOptions;
        proxyOptions = {
          disableCache: false
        };
      } else if (typeof proxyOptions === 'boolean') {
        proxyOptions = {
          disableCache: proxyOptions
        };
      }

      proxyOptions.targetService = targetService;

      if (options.paths.proxyCallback) {
        var restletIntegrateParams;
        if (matchedRestletIntegrateRule) {
          if (typeof options.restletIntegration[matchedRestletIntegrateRule].params === 'function') {
            logger.info('Match restlet integration rule and using aync manner, whitch using function to return `object`, to get restlet integration params: ', matchedRestletIntegrateRule);
            restletIntegrateParams = options.restletIntegration[matchedRestletIntegrateRule].params(req);
          } else {
            logger.info('Match restlet integration rule and using default manner, whitch just directly return `object`, to get restlet integration params: ', matchedRestletIntegrateRule);
            restletIntegrateParams = options.restletIntegration[matchedRestletIntegrateRule].params;
          }
        }
        if(matchedRestletIntegrateRule) {
          if(options.restletCache && options.restletCache.type === 'dcache') {
            if (!options.restletCache.cache) {
              logger.warn('restletCache.cache is empty');
            }
            getProxyTicketThroughRestletReqDcache.call(that, req, res, targetService, {
              name: matchedRestletIntegrateRule,
              params: restletIntegrateParams,
              cache: options.restletIntegrationIsUsingCache,
              getRestletIntegrateRuleKey: options.getRestletIntegrateRuleKey,
              restletCache: options.restletCache,
            }, callback);
          } else {
            getProxyTicketThroughRestletReq.call(that, req, res, targetService, {
              name: matchedRestletIntegrateRule,
              params: restletIntegrateParams,
              cache: options.restletIntegrationIsUsingCache,
              getRestletIntegrateRuleKey: options.getRestletIntegrateRuleKey,
              restletCache: options.restletCache,
            }, callback);
          }
        } else {
          getProxyTicket.call(that, req, res, proxyOptions, callback);
        }
      } else {
        logger.warn('options.paths.proxyCallback is not set, CAS is on non-proxy mode, you should not request a proxy ticket for non-proxy mode!');
        // TODO: Should this throw an error?
        // new Error('options.paths.proxyCallback is not set, CAS is on non-proxy mode, you should not request a proxy ticket for non-proxy mode!'
        callback();
      }
    };

    if (matchedRestletIntegrateRule) {
      logger.info('Match restlet integration rule: ', matchedRestletIntegrateRule);
      return doNext(function(req, res, next) {
        next();
      });
    }

    if (utils.shouldIgnore(req, options)) return doNext(function(req, res, next) {
      next();
    });

    if (method === 'GET') {
      switch (pathname) {
        case options.paths.validate:
          return validate(req, res, doNext, options);
        case that.proxyCallbackPathName:
          return proxyCallback(req, doNext, options);
      }
    }
    else if (method === 'POST' && pathname === options.paths.validate && options.slo) {
      return slo(req, doNext, options);
    }

    return authenticate(req, doNext, options);

    function doNext(callback) {
      if (options.hooks && typeof options.hooks.after === 'function') {
        options.hooks.after(req, res, function() {
          callback(req, res, next);
        });
      } else {
        callback(req, res, next);
      }
    }
  }
};

ConnectCas.prototype.logout = function() {
  var options = this.options;

  return function(req, res) {
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
