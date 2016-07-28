var Express = require('express');
var http = require('http');
var url = require('url');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var MemoryStore = require('session-memory-store');

var expect = require('chai').expect;

var casClientFactory = require('./lib/casClientFactory');

var utils = require('../lib/utils');

var PTStore = require('../lib/ptStroe');

var handleCookies = require('./lib/handleCookie');

describe('PTStore功能正常', function() {

  var app, server, ptStore, logger,
    localhost = 'http://localhost:3004',
    ptKey = 'key',
    ptValue = 'I am a pt';

  beforeEach(function(done) {
    app = new Express();

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

    logger = function() {
      return function() {
      };
    };
    server = http.createServer(app);

    server.listen(3004, function(err) {
      if (err) throw err;
      done();
    });
  });

  afterEach(function(done) {
    server.close(function(err) {
      if (err) throw err;
      done();
    })
  });

  it('未初始化, 直接get, remove, clear, 不会出现异常', function(done) {
    ptStore = new PTStore({
      logger: logger
    });

    app.get('/get', function(req, res) {
      ptStore.get(req, ptKey, function(err, value) {
        if (err) throw err;
        res.send(value);
      });
    });

    app.get('/remove', function(req, res) {
      ptStore.remove(req, ptKey, function(err) {
        if (err) throw err;
        res.send('ok');
      });
    });

    app.get('/clear', function(req, res) {
      ptStore.clear(req, function(err) {
        if (err) throw err;
        res.send('ok');
      });
    });

    var cookies;

    utils.getRequest(localhost + '/get', function(err, response) {
      if (err) throw err;

      expect(response.status).to.equal(200);
      expect(response.body).to.be.empty;

      cookies = handleCookies.setCookies(response.header);

      utils.getRequest(localhost + '/remove', {
        headers: {
          Cookie: handleCookies.getCookies(cookies)
        }
      }, function(err, response) {
        if (err) throw err;

        expect(response.status).to.equal(200);

        // 获取
        utils.getRequest(localhost + '/clear', {
          headers: {
            Cookie: handleCookies.getCookies(cookies)
          }
        }, function(err, response) {
          if (err) throw err;

          expect(response.status).to.equal(200);

          done();
        });
      });
    });

  });

  it('set后, 在过期时间内, 可以正常获取', function(done) {

    ptStore = new PTStore();

    app.use(function(req, res, next) {
      ptStore.set(req, ptKey, ptValue, function(err) {
        if (err) throw err;

        next();
      });
    });

    app.use(function(req, res, next) {
      ptStore.get(req, ptKey, function(err, value) {
        if (err) throw err;
        expect(value).to.equal(ptValue);
        next();
      })
    });

    app.get('/', function(req, res) {
      res.send('ok');
      done();
    });

    utils.getRequest(localhost, function(err, response) {
      if (err) throw err;

      expect(response.status).to.equal(200);
    });
  });

  it('set后, 立刻获取能够获取, 但超过过期时间, 无法获取', function(done) {
    ptStore = new PTStore({
      ttl: 1000
    });

    app.get('/set', function(req, res) {
      ptStore.set(req, ptKey, ptValue, function(err) {
        if (err) throw err;
        res.send('ok');
      });
    });

    app.get('/get', function(req, res) {
      ptStore.get(req, ptKey, function(err, value) {
        if (err) throw err;
        res.send(value);
      })
    });

    var cookies = {};

    utils.getRequest(localhost + '/set', function(err, response) {
      if (err) throw err;

      cookies = handleCookies.setCookies(response.header);

      setTimeout(function() {
        utils.getRequest(localhost + '/get', {
          headers: {
            Cookie: handleCookies.getCookies(cookies)
          }
        }, function(err, response) {
          if (err) throw err;

          expect(response.body).to.equal(ptValue);

          setTimeout(function() {
            utils.getRequest(localhost + '/get', {
              headers: {
                Cookie: handleCookies.getCookies(cookies)
              }
            }, function(err, response) {
              if (err) throw err;

              expect(response.body.value).to.be.empty;

              done();
            });
          }, 1000);

        });
      }, 500);
    });
  });

  it('remove后, 无论存不存在都正常响应, 删除后get不到该pt', function(done) {
    ptStore = new PTStore();

    app.get('/set', function(req, res) {
      ptStore.set(req, ptKey, ptValue, function(err) {
        if (err) throw err;
        res.send('ok');
      });
    });

    app.get('/get', function(req, res) {
      ptStore.get(req, ptKey, function(err, value) {
        if (err) throw err;
        res.send(value);
      })
    });

    app.get('/remove', function(req, res) {
      ptStore.remove(req, ptKey, function(err) {
        if (err) throw err;

        res.send('ok');
      });
    });

    var cookies = {};

    // 设置
    utils.getRequest(localhost + '/set', function(err, response) {
      if (err) throw err;

      cookies = handleCookies.setCookies(response.header);

      // 获取
      utils.getRequest(localhost + '/get', {
        headers: {
          Cookie: handleCookies.getCookies(cookies)
        }
      }, function(err, response) {
        if (err) throw err;

        // 应该能获取得到
        expect(response.body).to.equal(ptValue);

        // 删除
        utils.getRequest(localhost + '/remove', {
          headers: {
            Cookie: handleCookies.getCookies(cookies)
          }
        }, function(err, response) {
          if (err) throw err;

          // 删除
          utils.getRequest(localhost + '/get', {
            headers: {
              Cookie: handleCookies.getCookies(cookies)
            }
          }, function(err, response) {
            if (err) throw err;

            expect(response.body).to.be.empty;
            done();
          });
        });
      });
    });
  });

  it('clear后, 啥都获取不到', function(done) {
    ptStore = new PTStore();

    app.get('/set', function(req, res) {
      ptStore.set(req, ptKey, ptValue, function(err) {
        if (err) throw err;
        res.send('ok');
      });
    });

    app.get('/get', function(req, res) {
      ptStore.get(req, ptKey, function(err, value) {
        if (err) throw err;
        res.send(value);
      })
    });

    app.get('/clear', function(req, res) {
      ptStore.clear(req, function(err) {
        if (err) throw err;

        res.send('ok');
      });
    });

    var cookies = {};

    // 设置
    utils.getRequest(localhost + '/set', function(err, response) {
      if (err) throw err;

      cookies = handleCookies.setCookies(response.header);

      // 获取
      utils.getRequest(localhost + '/get', {
        headers: {
          Cookie: handleCookies.getCookies(cookies)
        }
      }, function(err, response) {
        if (err) throw err;

        // 应该能获取得到
        expect(response.body).to.equal(ptValue);

        // 删除
        utils.getRequest(localhost + '/clear', {
          headers: {
            Cookie: handleCookies.getCookies(cookies)
          }
        }, function(err, response) {
          if (err) throw err;

          // 删除
          utils.getRequest(localhost + '/get', {
            headers: {
              Cookie: handleCookies.getCookies(cookies)
            }
          }, function(err, response) {
            if (err) throw err;

            expect(response.body).to.be.empty;
            done();
          });
        });
      });
    });
  });

});