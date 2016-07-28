var casServer = require('./lib/casServer');
var Express = require('express');
var http = require('http');

var url = require('url');

var expect = require('chai').expect;

var casServerFactory = require('./lib/casServer');
var casClientFactory = require('./lib/casClientFactory');

var utils = require('../lib/utils');

var handleCookies = require('./lib/handleCookie');


describe('logout中间件正常', function() {
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
        proxyCallback: ''
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

  it('调用logout中间件后, 注销session, 并302到/cas/logout', function(done) {
    hookAfterCasConfig = function(req, res, next) {
      if (req.path === '/') {
        res.send(req.session.cas);
      } else {
        next();
      }
    };

    utils.getRequest(casRootPath + '/cas/login?service=' + encodeURIComponent(clientPath + '/cas/validate'), function(err, response) {
      if (err) throw err;

      expect(response.status).to.equal(302);

      var redirectLocation = response.header.location;
      var cookies;

      utils.getRequest(redirectLocation, function(err, response) {
        if (err) throw err;

        cookies = handleCookies.setCookies(response.header);

        expect(response.status).to.equal(302);
        expect(response.header.location).to.equal('/');

        utils.getRequest(clientPath + '/', {
          headers: {
            Cookie: handleCookies.getCookies(cookies)
          }
        }, function(err, response) {
          if (err) throw err;

          expect(response.status).to.equal(200);
          expect(response.body).to.not.be.empty;
          var body = JSON.parse(response.body);

          expect(body.user).to.not.be.empty;
          expect(body.st).to.not.be.empty;

          utils.getRequest(clientPath + '/logout', {
            headers: {
              Cookie: handleCookies.getCookies(cookies)
            }
          }, function(err, response) {
            if (err) throw err;
            expect(response.status).to.equal(302);
            expect(response.header.location.indexOf(casRootPath + '/cas/logout') > -1).to.be.true;
            done();
          });
        })
      });
    })
  })
});