var casServer = require('./lib/casServer');
var Express = require('express');
var http = require('http');

var url = require('url');

var expect = require('chai').expect;

var casServerFactory = require('./lib/casServer');
var casClientFactory = require('./lib/casClientFactory');

var utils = require('../lib/utils');

var handleCookies = require('./lib/handleCookie');


var getLogoutXml = function(sessionId) {
  return '<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"' +
    'ID="[RANDOM ID]" Version="2.0" IssueInstant="[CURRENT DATE/TIME]">' +
    '<saml:NameID xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">' +
    '@NOT_USED@' +
    '</saml:NameID>' +
    '<samlp:SessionIndex>' + sessionId + '</samlp:SessionIndex>' +
    '</samlp:LogoutRequest>';
};

describe('slo能够正确响应并注销', function() {

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

  it('slo能够正确响应并注销登录', function(done) {
    hookAfterCasConfig = function(req, res, next) {
      if (req.path === '/') {
        res.send({
          cas: req.session.cas,
          id: req.session.id
        });
      } else {
        next();
      }
    };

    utils.getRequest(casRootPath + '/cas/login?service=' + encodeURIComponent(clientPath + '/cas/validate'), function(err, response) {
      if (err) throw err;

      expect(response.status).to.equal(302);

      var redirectLocation = response.header.location;
      var uri = url.parse(redirectLocation, true);

      var ticket = uri.query.ticket;
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

          expect(body.cas.user).to.not.be.empty;
          expect(body.cas.st).to.not.be.empty;
          expect(body.cas.pgt).to.not.be.empty;
          expect(body.id).to.not.be.empty;

          // 到这里, 成功登录

          utils.postRequest(clientPath + '/cas/validate', getLogoutXml(ticket), function(err, response) {
            if (err) throw err;
            expect(response.status).to.equal(200);

            utils.getRequest(clientPath, {
              headers: {
                Cookie: handleCookies.getCookies(cookies)
              }
            }, function(err, response) {
              if (err) throw err;

              // console.log(response);
              expect(response.status).to.equal(302);
              expect(response.header.location.indexOf('/cas/login') > -1).to.be.true;
              done();
            });
          });
        })
      });
    })
  });


  it('slo发送非法xml, 响应202', function(done) {
    hookAfterCasConfig = function(req, res, next) {
      if (req.path === '/') {
        res.send({
          cas: req.session.cas,
          id: req.session.id
        });
      } else {
        next();
      }
    };

    utils.getRequest(casRootPath + '/cas/login?service=' + encodeURIComponent(clientPath + '/cas/validate'), function(err, response) {
      if (err) throw err;

      expect(response.status).to.equal(302);

      var redirectLocation = response.header.location;
      var uri = url.parse(redirectLocation, true);

      var ticket = uri.query.ticket;
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

          expect(body.cas.user).to.not.be.empty;
          expect(body.cas.st).to.not.be.empty;
          expect(body.cas.pgt).to.not.be.empty;
          expect(body.id).to.not.be.empty;

          // 到这里, 成功登录

          utils.postRequest(clientPath + '/cas/validate', 'some invalid string', function(err, response) {
            if (err) throw err;
            expect(response.status).to.equal(202);

            utils.getRequest(clientPath, {
              headers: {
                Cookie: handleCookies.getCookies(cookies)
              }
            }, function(err, response) {
              if (err) throw err;

              // console.log(response);
              expect(response.status).to.equal(200);
              done();
            });
          });
        })
      });
    })


  });

});