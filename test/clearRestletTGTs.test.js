var casServer = require('./lib/casServer');
var Express = require('express');
var http = require('http');

var url = require('url');

var expect = require('chai').expect;

var casServerFactory = require('./lib/casServer');
var casClientFactory = require('./lib/casClientFactory');

var utils = require('../lib/utils');

var handleCookies = require('./lib/handleCookie');

var globalPGTStore = require('../lib/globalStoreCache');
var rewire = require('rewire');
var getPTThroughtRestletReq = rewire('../lib/getProxyTicketThroughRestletReq.js');

describe('清理全局tgt工作正常', function() {
  var casClientApp, casClientServer, casServerApp, casServer,
    localhost = 'http://localhost',
    casPort = '3004',
    clientPort = '3002',
    casRootPath = localhost + ':' + casPort,
    clientPath = localhost + ':' + clientPort,
    hookBeforeCasConfig, hookAfterCasConfig;

  beforeEach(function(done) {

    casServerApp = new Express();

    casServerFactory(casServerApp);

    casServer = http.createServer(casServerApp);

    casClientApp = new Express();

    casClientFactory(casClientApp, {
      servicePrefix: clientPath,
      serverPath: casRootPath,
      paths: {
        restletIntegration: '/cas/v1/tickets'
      },
      restletIntegration: {
        demo1: {
          trigger: function(req) {
            if (req.path.indexOf('restlet') > -1 || req.path.indexOf('clearRestlet') > -1) return true;
          },
          params: {
            username: 'username',
            from: 'somewhere',
            type: 8,
            password: 'password'
          }
        }
      },
      logger: function(req, type) {
        return function() {
        };
      }
    }, function(app) {
      app.use(function(req, res, next) {
        if (typeof hookBeforeCasConfig === 'function') {
          hookBeforeCasConfig(req, res, next);
        } else {
          next();
        }
      });
    }, function(app) {
      app.use(function(req, res, next) {
        if (typeof hookAfterCasConfig === 'function') {
          hookAfterCasConfig(req, res, next);
        } else {
          next();
        }
      });
    });

    casClientServer = http.createServer(casClientApp);

    casServer.listen(3004, function(err) {
      if (err) throw err;

      casClientServer.listen(3002, function(err) {
        if (err) throw err;

        done();
      });
    });
  });

  afterEach(function(done) {
    hookAfterCasConfig = null;
    hookBeforeCasConfig = null;
    casServer.close(function(err) {
      if (err) throw err;
      casClientServer.close(function(err) {
        if (err) throw err;
        done();
      });
    });
  });

  it('正常获取tgt, 并且能够正常获取pt后, 调用清理tgt接口, 再用老tgt换pt失败', function(done) {
    var pgt, pt;

    hookAfterCasConfig = function(req, res, next) {
      if (req.path === '/restlet') {
        if (req.query && req.query.time) {
          var cachedPgt = globalPGTStore.get('demo1');
          expect(cachedPgt).to.equal(pgt);
        }
        req.getProxyTicket('some targetService', function(err, pt) {
          if (err) throw err;

          pgt = globalPGTStore.get('demo1');
          expect(pgt).to.not.be.empty;

          res.send(pt);
        })
      } else if (req.path === '/clearRestlet') {
        req.clearRestlet(function() {
          res.send('ok');
        });
      } else {
        next();
      }
    };

    var cookies;

    utils.getRequest(clientPath + '/restlet', function(err, response) {
      if (err) throw err;
      cookies = handleCookies.setCookies(response.header);

      expect(response.status).to.equal(200);
      expect(response.body).to.not.be.empty;
      pt = response.body;

      utils.getRequest(clientPath + '/clearRestlet', {
        headers: {
          Cookie: handleCookies.getCookies(cookies)
        }
      }, function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);

        utils.getRequest(casRootPath + '/cas/proxy?pgt=' + pgt + '&targetService=xxx', function(err, response) {
          if (err) throw err;

          var nowPt = getPTThroughtRestletReq.__get__('parseResponse')(response.body);
          expect(nowPt).to.be.empty;
          done();
        })
      })
    })
  });

});