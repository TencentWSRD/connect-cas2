
/**
 * For testing usage, separate the global config of the app
 */
var path = require('path');
var session = require('express-session');

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var CasClient = require('../index');
var ejs = require('ejs');
var morgan = require('morgan');

var _ = require('lodash');

/**
 *
 * @param app
 * @param {Object} casOptions (Optional)
 * @param {Function} hookBeforeCasConfig (Optional)
 * @param {Function} hookAfterCasConfig (Optional)
 * @returns {*}
 */
module.exports = function(app, casOptions, hookBeforeCasConfig, hookAfterCasConfig) {
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser('here is some secret'));

  var MemoryStore = require('session-memory-store')(session);

  app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: 'I am a secret',
    name: 'jssessionid',
    store: new MemoryStore()
  }));

  app.engine('.html', ejs.renderFile);
  app.set('view engine', 'html');
  app.set('views', path.join(__dirname, './views'));

  var demoParams = {
    appId: '900007430',
    pid: '1',
    type: 8,
    appKey: 'BXEKfudgcgVDBb8k'
  };

  if (typeof hookBeforeCasConfig === 'function') hookBeforeCasConfig(app);

  var defaultOptions = {
    debug: true,
    ignore: [
      /\/ignore/
    ],
    match: [],
    servicePrefix: 'http://10.17.86.87:8080',
    serverPath: 'http://cas.sdet.wsd.com',
    paths: {
      validate: '/cas/validate',
      serviceValidate: '/cas/serviceValidate',
      proxy: '/cas/proxy',
      login: '/cas/login',
      logout: '/cas/logout',
      proxyCallback: '/cas/proxyCallback',
      restletIntegration: '/buglycas/v1/tickets'
    },
    redirect: false,
    gateway: false,
    renew: false,
    slo: true,
    cache: {
      enable: true,
      ttl: 5 * 60 * 1000,
      filter: [
        // /betaserverpre\.et\.wsd\.com/
      ]
    },
    fromAjax: {
      header: 'x-client-ajax',
      status: 418
    },
    // logger: function(req, type) {
    //   return function() {
    //   };
    // },
    restletIntegration: {
      demo1: {
        trigger: function(req) {
          // console.log('Checking restletIntegration rules');
          return false
        },
        params: {
          username: demoParams.appId + '_' + demoParams.pid,
          from: 'http://10.17.86.87:8080/cas/validate',
          type: demoParams.type,
          password: JSON.stringify({ appId: demoParams.appId + '_' + demoParams.pid, appKey: demoParams.appKey })
        }
      }
    }
  };
  
  if (casOptions) {
    _.merge(defaultOptions, casOptions);
  }

  // console.log('defaultOptions', defaultOptions);

// CAS config
// =============================================================================
  var casClient = new CasClient(defaultOptions);

  app.use(casClient.core());
  
  if (typeof hookAfterCasConfig === 'function') hookAfterCasConfig(app);

  // if (typeof hookAfterCasConfig === 'function') {
  //   console.log('hookAfterCasConfig', hookAfterCasConfig);
  //   hookAfterCasConfig(app);
  // }

  app.get('/logout', casClient.logout());

  // app.get('/', function(req, res) {
  //   res.render('index.ejs');
  // });

  return app;
};