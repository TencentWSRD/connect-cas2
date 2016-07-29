var utils = require('../lib/utils');
var expect = require('chai').expect;

var Express = require('express');
var bodyParser = require('body-parser');

var url = require('url');
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');

describe('utils单元测试', function() {

  var app, server, httpsServer;

  var localPath = 'http://localhost:3002',
    port = '3002',
    httpsPort = '3003',
    httpsLocalPath = 'https://localhost:3003';

  var loggerFactory = function(req, type) {
    return function() {
    };
  };

  before(function(done) {
    app = new Express();

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.get('/', function(req, res) {
      res.send({
        message: 'ok'
      });
    });

    app.delete('/', function(req, res) {
      res.send({
        message: 'ok'
      });
    });

    app.post('/', function(req, res) {
      res.send(req.body);
    });

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    var libRoot = path.resolve(__dirname, './lib');

    var options = {
      key: fs.readFileSync(libRoot + '/client-key.pem'),
      cert: fs.readFileSync(libRoot + '/client-cert.pem'),
      requestCert: false,
      rejectUnhauthorized: false
    };

    server = http.createServer(app).listen(port, function(err) {
      if (err) throw err;

      httpsServer = https.createServer(options, app).listen(httpsPort, function(err) {
        if (err) throw err;

        done();
      });
    });


  });

  after(function(done) {
    server.close(function(err) {
      if (err) throw err;

      httpsServer.close(function(err) {
        if (err) throw err;
        done();
      });
    });
  });

  it('toArray, 传入伪数组, 输出真正数组', function() {
    function aFunction() {
      expect(utils.toArray(arguments)).to.be.a('array');
      expect(utils.toArray(null)).to.be.a('array');
      expect(utils.toArray(undefined)).to.be.a('array');
      expect(utils.toArray(NaN)).to.be.a('array');
      expect(utils.toArray(1)).to.be.a('array');
      expect(utils.toArray('hi')).to.be.a('array');
      expect(utils.toArray({})).to.be.a('array');

    }

    aFunction(1, 2, 3);
  });

  it('getPath传入指定名称, 返回拼好的路径', function() {
    var options = {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: '/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets'
      }
    };

    expect(utils.getPath('login', options)).to.equal('http://cas.sdet.wsd.com/cas/login?service=' + encodeURIComponent('http://localhost:8080/cas/validate'));
    expect(utils.getPath('logout', options)).to.equal('http://cas.sdet.wsd.com/cas/logout?service=' + encodeURIComponent('http://localhost:8080/cas/validate'));
    expect(utils.getPath('pgtUrl', options)).to.equal('http://localhost:8080/cas/proxyCallback');

    // absolute path
    expect(utils.getPath('pgtUrl', {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: 'http://10.17.86.87:8080/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets'
      }
    })).to.equal('http://10.17.86.87:8080/cas/proxyCallback');

    expect(utils.getPath('serviceValidate', options)).to.equal('http://cas.sdet.wsd.com/cas/serviceValidate');
    expect(utils.getPath('proxy', options)).to.equal('http://cas.sdet.wsd.com/cas/proxy');
    expect(utils.getPath('service', options)).to.equal('http://localhost:8080/cas/validate');
    expect(utils.getPath('validate', options)).to.equal('http://localhost:8080/cas/validate');

    expect(utils.getPath('restletIntegration', options)).to.equal('http://cas.sdet.wsd.com/cas/v1/tickets');
  });

  it('isMatchRule校验规则符合预期', function() {
    var req = {
      path: '/'
    };

    expect(utils.isMatchRule(req, '/', '/')).to.be.true;
    expect(utils.isMatchRule(req, '/', '/api')).to.be.false;

    expect(utils.isMatchRule(req, '/', /\//)).to.be.true;
    expect(utils.isMatchRule(req, '/', /\/api/)).to.be.false;

    expect(utils.isMatchRule(req, '/', function(path, req) {
      return path === '/';
    })).to.be.true;

    expect(utils.isMatchRule(req, '/', function(path, req) {
      return path === '/api';
    })).to.be.false;
  });

  it('getOrigin能够获取正确原始路径', function() {
    var req = {
      originalUrl: '/api',
      query: {
        ticket: 'some ticket'
      }
    };
    expect(utils.getOrigin(req, {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: 'http://10.17.86.87:8080/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets'
      }
    })).to.equal('http://localhost:8080/api');
  });

  it('shouldIgnore能够正确的解析规则', function() {
    var req = {
      path: '/'
    };

    expect(utils.shouldIgnore(req, {
      match: ['/'],
      logger: loggerFactory
    })).to.be.false;

    expect(utils.shouldIgnore(req, {
      match: ['/api'],
      logger: loggerFactory
    })).to.be.true;

    expect(utils.shouldIgnore(req, {
      match: [/\//],
      logger: loggerFactory
    })).to.be.false;

    expect(utils.shouldIgnore(req, {
      match: [/\/api/],
      logger: loggerFactory
    })).to.be.true;

    expect(utils.shouldIgnore(req, {
      match: [function(pathname, req) {
        return pathname === '/';
      }],
      logger: loggerFactory
    })).to.be.false;

    expect(utils.shouldIgnore(req, {
      match: [function(pathname, req) {
        return pathname === '/api';
      }],
      logger: loggerFactory
    })).to.be.true;

    expect(utils.shouldIgnore(req, {
      ignore: ['/'],
      logger: loggerFactory
    })).to.be.true;

    expect(utils.shouldIgnore(req, {
      ignore: ['/api'],
      logger: loggerFactory
    })).to.be.false;

    expect(utils.shouldIgnore(req, {
      ignore: [/\//],
      logger: loggerFactory
    })).to.be.true;

    expect(utils.shouldIgnore(req, {
      ignore: [/\/api/],
      logger: loggerFactory
    })).to.be.false;

    expect(utils.shouldIgnore(req, {
      ignore: [function(pathname, req) {
        return pathname === '/';
      }],
      logger: loggerFactory
    })).to.be.true;

    expect(utils.shouldIgnore(req, {
      ignore: [function(pathname, req) {
        return pathname === '/api';
      }],
      logger: loggerFactory
    })).to.be.false;

    expect(utils.shouldIgnore(req, {
      ignore: [],
      match: [],
      logger: loggerFactory
    })).to.be.false;
  });

  it('getLastUrl能够正确的获取最后的访问路径, 并设置默认值', function() {

    var options = {
      servicePrefix: 'http://localhost:8080',
      serverPath: 'http://cas.sdet.wsd.com',
      paths: {
        validate: '/cas/validate',
        serviceValidate: '/cas/serviceValidate',
        proxy: '/cas/proxy',
        login: '/cas/login',
        logout: '/cas/logout',
        proxyCallback: '/cas/proxyCallback',
        restletIntegration: '/cas/v1/tickets'
      },
      logger: loggerFactory
    };

    expect(utils.getLastUrl({
      session: {
        lastUrl: 'http://localhost:8080/api'
      }
    }, options)).to.equal('http://localhost:8080/api');

    expect(utils.getLastUrl({
      session: {
        lastUrl: 'http://localhost:8080/'
      }
    }, options)).to.equal('http://localhost:8080/');

    expect(utils.getLastUrl({
      session: {
        lastUrl: 'http://localhost:8080/cas/validate'
      }
    }, options)).to.equal('/');

    expect(utils.getLastUrl({}, options)).to.equal('/');
  });

  it('getRequest能够正确发送http GET请求,接收请求', function(done) {
    utils.getRequest(localPath, function(err, res) {
      if (err) throw err;

      expect(res.status).to.equal(200);

      expect(res.body).to.equal(JSON.stringify({
        message: 'ok'
      }));

      done();
    });
  });

  it('getRequest能够正确发送https GET请求,接收请求', function(done) {
    utils.getRequest(httpsLocalPath, function(err, res) {
      if (err) throw err;
      expect(res.status).to.equal(200);

      expect(res.body).to.equal(JSON.stringify({
        message: 'ok'
      }));

      done();
    });
  });

  it('postRequest能够正确发送http POST请求,接收请求', function(done) {
    var data = {
      hello: 'world'
    };

    utils.postRequest(localPath, data, function(err, res) {
      if (err) {
        throw err;
      }

      expect(res.status).to.equal(200);
      expect(res.body).to.equal(JSON.stringify(data));

      done();
    });
  });

  it('postRequest能够正确发送http POST请求, 设置特殊头, 并接收请求', function(done) {
    var data = {
      hello: 'world'
    };

    utils.postRequest(localPath, data, {
      headers: {
        Cookie: 'Content-Type: application/json'
      }
    }, function(err, res) {
      if (err) {
        throw err;
      }

      expect(res.status).to.equal(200);
      expect(res.body).to.equal(JSON.stringify(data));

      done();
    });
  });

  it('postRequest能够正确发送https POST请求,接收请求', function(done) {
    var data = {
      hello: 'world'
    };

    utils.postRequest(httpsLocalPath, data, function(err, res) {
      if (err) {
        throw err;
      }

      expect(res.status).to.equal(200);
      expect(res.body).to.equal(JSON.stringify(data));

      done();
    });
  });

  it('deleteRequest能够正确发送http DELETE请求,接收请求', function(done) {
    utils.deleteRequest(localPath, function(err, res) {
      if (err) {
        throw err;
      }

      expect(res.status).to.equal(200);

      expect(res.body).to.equal(JSON.stringify({
        message: 'ok'
      }));

      done();
    });
  });

  it('deleteRequest能够正确发送https DELETE请求,接收请求', function(done) {
    utils.deleteRequest(httpsLocalPath, function(err, res) {
      if (err) {
        throw err;
      }
      expect(res.status).to.equal(200);

      expect(res.body).to.equal(JSON.stringify({
        message: 'ok'
      }));

      done();
    });
  });

  it('getLogger工作正常', function(done) {
    var app = new Express();

    app.use(function(req, res, next) {
      function getLogger(type) {
        var user = 'unknown';
        try {
          user = req.session.cas.user;
        } catch (e) {
        }

        if (!console[type]) {
          console.error('invalid console type', type);
          type = 'log';
        }

        return console[type].bind(console[type], req.sn + '|', user + '|', req.ip + '|');
      }

      req.getLogger = getLogger;
      next();
    });

    app.use(function(req, res, next) {
      var logger = utils.getLogger(req, {
        logger: function(req, type) {
          return req.getLogger(type);
        }
      });

      expect(typeof logger.info).to.equal('function');
      expect(typeof logger.warn).to.equal('function');
      expect(typeof logger.error).to.equal('function');
      expect(typeof logger.log).to.equal('function');

      logger = utils.getLogger(req);

      expect(typeof logger.info).to.equal('function');
      expect(typeof logger.warn).to.equal('function');
      expect(typeof logger.error).to.equal('function');
      expect(typeof logger.log).to.equal('function');

      next();
    });

    app.get('/', function(req, res) {
      res.send('ok');
    });

    var server = http.createServer(app);
    server.listen(3004, function(err) {
      if (err) throw err;
      utils.getRequest('http://localhost:3004/', function(err, response) {
        if (err) throw err;
        server.close(function(err) {
          if (err) throw err;
          done();
        })
      })
    });


  });
});