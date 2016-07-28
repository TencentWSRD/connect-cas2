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

describe('利用restlet integration访问正常', function() {

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
            if (req.path.indexOf('restlet') > -1) return true;
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

  it('未登陆下, 配置restletIntegration, 命中规则, 不需要跳登陆, 且能够正确获取pt, 再次调用时, 使用缓存的pgtId与缓存的pt', function(done) {
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

      utils.getRequest(clientPath + '/restlet', {
        params: {
          time: 1
        },
        headers: {
          Cookie: handleCookies.getCookies(cookies)
        }
      }, function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);
        expect(response.body).to.not.be.empty;
        expect(response.body).to.not.equal(pt);

        done();
      })
    })
  });

  it('登陆下, 配置restletIntegration, 命中规则, 命中规则的接口以restletIntegration的身份调取接口, 但不影响已登录用户的身份.', function(done) {
    var loginedPt, restletPt;
    globalPGTStore.clear();
    hookAfterCasConfig = function(req, res, next) {
      if (req.path === '/') {
        req.getProxyTicket('xxx', function(err, pt) {
          if (err) throw err;

          loginedPt = pt;
          res.send(pt);
        })
      } else if (req.path === '/restlet') {
        if (req.query && req.query.time) {
          var cachedPgt = globalPGTStore.get('demo1');
          expect(cachedPgt).to.not.be.empty;
        }
        req.getProxyTicket('xxx', function(err, pt) {
          if (err) throw err;

          restletPt = pt;
          res.send(pt);
        })
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

          // done();

          utils.getRequest(clientPath + '/restlet', {
            headers: {
              Cookie: handleCookies.getCookies(cookies)
            }
          }, function(err, response) {
            if (err) throw err;

            expect(response.status).to.equal(200);
            expect(response.body).to.not.be.empty;
            expect(loginedPt).to.not.equal(restletPt);
            done();
          });
        })
      });
    })
  });

  it('配置restletIntegration, 命中规则, 命中规则的接口以restletIntegration的身份调取接口, 再登陆, 然后访问正常接口, 互不影响', function(done) {

    var loginedPt, restletPt;

    globalPGTStore.clear();

    hookAfterCasConfig = function(req, res, next) {
      if (req.path === '/') {
        req.getProxyTicket('xxx', function(err, pt) {
          if (err) throw err;

          loginedPt = pt;
          res.send(pt);
        })
      } else if (req.path === '/restlet') {
        if (req.query && req.query.time) {
          var cachedPgt = globalPGTStore.get('demo1');
          expect(cachedPgt).to.not.be.empty;
        }
        req.getProxyTicket('xxx', function(err, pt) {
          if (err) throw err;

          restletPt = pt;
          res.send(pt);
        })
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

      utils.getRequest(casRootPath + '/cas/login?service=' + encodeURIComponent(clientPath + '/cas/validate'), {
        headers: {
          Cookie: handleCookies.getCookies(cookies)
        }
      }, function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(302);

        var redirectLocation = response.header.location;

        utils.getRequest(redirectLocation, {
          headers: {
            Cookie: handleCookies.getCookies(cookies)
          }
        }, function(err, response) {
          if (err) throw err;

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

            expect(loginedPt).to.not.equal(restletPt);

            done();
          })
        });
      })
    });
  });

  it('未登陆下, 配置restletIntegration, 命中规则, 乱设一个pgt在globalStore, 能够自动重试并重新获取pgt, 然后获取pt', function(done) {
    globalPGTStore.clear();
    globalPGTStore.set('demo1', 'some invalid pgt');

    var invalidPgt, validPgt;

    hookAfterCasConfig = function(req, res, next) {
      if (req.path === '/restlet') {
        invalidPgt = globalPGTStore.get('demo1');

        req.getProxyTicket('xxx', function(err, pt) {
          if (err) throw err;

          // should refetch a new pgt
          validPgt = globalPGTStore.get('demo1');

          expect(validPgt).to.not.equal(invalidPgt);
          expect(pt).to.not.be.empty;
          res.send(pt);
        })
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

      done();
    });
  });

  it('未登陆下, 配置restletIntegration, 命中规则, 乱设一个pgt在globalStore, 获取pt失败, 但能够自动重试并重新获取pgt, 但是再次获取pt还是失败, 直接退出不再重试', function(done) {
    globalPGTStore.clear();
    globalPGTStore.set('demo1', 'some invalid pgt');

    var invalidPgt, validPgt;

    hookAfterCasConfig = function(req, res, next) {
      if (req.path === '/restlet') {
        invalidPgt = globalPGTStore.get('demo1');

        req.getProxyTicket('invalid', function(err, pt) {
          if (err) {
            return res.status(401).send(err);
          }

          res.send(pt);
        })
      } else {
        next();
      }
    };

    var cookies;

    utils.getRequest(clientPath + '/restlet', function(err, response) {
      if (err) throw err;
      cookies = handleCookies.setCookies(response.header);

      expect(response.status).to.equal(401);

      done();
    });
  });
});