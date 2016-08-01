var casServer = require('./lib/casServer');
var Express = require('express');
var http = require('http');

var url = require('url');

var expect = require('chai').expect;

var casServerFactory = require('./lib/casServer');
var casClientFactory = require('./lib/casClientFactory');

var utils = require('../lib/utils');

var handleCookies = require('./lib/handleCookie');

describe('proxyCallback符合预期', function() {
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
      hooks: {
        before: function(req, res, next) {
          req.start = Date.now();
          next();
        },
        after: function(req, res, next) {
          expect(req.start).to.not.be.empty;
          next();
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
    casServer.close();
    casClientServer.close();
    done();
  });

  it('啥参数都不带直接调用, 或是参数不合法(无pgtIou或pgtId) 直接响应200', function(done) {
    utils.getRequest(clientPath + '/cas/proxyCallback', function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(200);

      utils.getRequest(clientPath + '/cas/proxyCallback?pgtIou=xxx', function(err, response) {
        if (err) throw err;
        expect(response.status).to.equal(200);

        utils.getRequest(clientPath + '/cas/proxyCallback?pgtId=xxx', function(err, response) {
          if (err) throw err;
          expect(response.status).to.equal(200);

          done();
        });
      })
    })
  });

  it('传入pgtId/pgtIou, 能够正确存入, 并能通过pgtIou找到pgtId', function(done) {

    var fakePgtIou = 'pgtIou',
      fakePgtId = 'pgtId';

    hookBeforeCasConfig = function(req, res, next) {
      if (req.path == '/get') {
        expect(req.query.pgtIou).to.not.be.empty;
        req.sessionStore.get(req.query.pgtIou, function(err, session) {
          if (err) throw err;

          expect(session.pgtId).to.equal(fakePgtId);
          done();
        })
      } else {
        next();
      }
    };

    utils.getRequest(clientPath + '/cas/proxyCallback?pgtIou=' + fakePgtIou + '&pgtId=' + fakePgtId, function(err, response) {
      if (err) throw err;

      expect(response.status).to.equal(200);
      var cookies = handleCookies.setCookies(response.header);

      utils.getRequest(clientPath + '/get?pgtIou=' + fakePgtIou, {
        headers: {
          Cookie: handleCookies.getCookies(cookies)
        }
      }, function(err, response) {
        if (err) throw err;
      });

    });

  });

});