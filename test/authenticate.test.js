var expect = require('chai').expect;
var http = require('http');
var url = require('url');

var utils = require('../lib/utils');

var casClientFactory = require('./lib/casClientFactory');
var Express = require('express');

describe('校验判断登陆状态', function() {

  var reqUrl = 'http://localhost:3002';

  var app, server;

  beforeEach(function(done) {
    app = new Express();

    server = http.createServer(app);

    server.listen(3002, function(err) {
      if (err) throw err;

      done();
    });
  });

  it('非proxy模型,session中无pt, 跳登录页', function(done) {

    casClientFactory(app, {
      logger: function(req, type) {
        return function() {
        };
      },
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
      paths: {
        proxyCallback: null
      }
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    utils.getRequest(reqUrl, function(err, response) {
      if (err) throw err;

      expect(response.status).to.equal(302);
      done();
    });
  });

  it('proxy模型,session中无pt, 跳登录页', function(done) {

    casClientFactory(app, {
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
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    utils.getRequest(reqUrl, function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(302);
      done();
    });
  });

  it('非proxy模型,session中有st, 正常响应', function(done) {

    casClientFactory(app, {
      paths: {
        proxyCallback: null
      },
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
        req.session.cas = {
          user: '156260767',
          st: 'st'
        };
        req.session.save(function(err) {
          if (err) throw err;
          next();
        });

      });
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    utils.getRequest(reqUrl, function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(200);
      done();
    });
  });

  it('proxy模型,session中有st,无pgt,302', function(done) {
    casClientFactory(app, {
      // paths: {
      //   proxyCallback: null
      // },
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
        req.session.st = 'st';
        req.session.cas = {
          userId: '156260767'
        };
        req.session.save(function(err) {
          if (err) throw err;
          next();
        });

      });
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    utils.getRequest(reqUrl, function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(302);
      done();
    });
  });

  it('proxy模型,session中有st,无pgt,POST请求, 302', function(done) {
    casClientFactory(app, {
      // paths: {
      //   proxyCallback: null
      // },
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
        req.session.st = 'st';
        req.session.cas = {
          userId: '156260767'
        };
        req.session.save(function(err) {
          if (err) throw err;
          next();
        });

      });
    });

    app.post('/', function(req, res) {
      res.send('ok');
    });

    utils.postRequest(reqUrl, {}, function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(302);
      done();
    });
  });

  it('proxy模型,session中有st,有pgt,正常响应', function(done) {
    casClientFactory(app, {
      // paths: {
      //   proxyCallback: null
      // },
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
        req.session.cas = {
          userId: '156260767',
          st: 'st',
          pgt: 'pgt'
        };
        req.session.save(function(err) {
          if (err) throw err;
          next();
        });

      });
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    utils.getRequest(reqUrl, function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(200);
      done();
    });
  });

  it('身份无效, 但是有fetch头, 响应418', function(done) {
    casClientFactory(app, {
      fromAjax: {
        header: 'x-client-ajax',
        status: 418
      },
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
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    utils.getRequest(reqUrl, {
      headers: {
        'x-client-ajax': 'fetch'
      }
    }, function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(418);
      done();
    });
  });

  it('配置ignore字符串规则,匹配跳过cas鉴权', function(done) {
    casClientFactory(app, {
      ignore: [
        '/'
      ],
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
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    utils.getRequest(reqUrl, function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(200);
      done();
    });
  });

  it('配置ignore正则规则,匹配跳过cas鉴权', function(done) {
    casClientFactory(app, {
      ignore: [
        /\//
      ],
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
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    utils.getRequest(reqUrl, function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(200);
      done();
    });
  });

  it('配置ignore函数规则,匹配跳过cas鉴权', function(done) {
    casClientFactory(app, {
      ignore: [
        function(pathname, req) {
          if (pathname === '/') return true;
        }
      ],
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
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    utils.getRequest(reqUrl, function(err, response) {
      if (err) throw err;
      expect(response.status).to.equal(200);
      done();
    });
  });

  afterEach(function() {
    app = null;
    server.close();
    server = null;
  });
});