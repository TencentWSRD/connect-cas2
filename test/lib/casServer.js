/**
 * Simple CAS server implement for test case.
 *
 */

var http = require('http');
var Express = require('express');
var session = require('express-session');
var SessionStore = require('session-memory-store');

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

var uuid = require('uuid');
var utils = require('../../lib/utils');

var url = require('url');

// var st = uuid.v4();
// var pgtIou = 'PGTIOU-3-cyz9mq6SaNYsGXj7BEO2-login.rdm.org';
// var pgtId = uuid.v4();

function getSuccessResponse(pgtIou) {
  var res = '<cas:serviceResponse xmlns:cas=\'http://www.yale.edu/tp/cas\'>' +
    '<cas:authenticationSuccess>' +
    '<cas:user>DEFAULT_USER_NAME</cas:user>';

  if (pgtIou) res += '<cas:proxyGrantingTicket>' + pgtIou + '</cas:proxyGrantingTicket>';

  res += '</cas:authenticationSuccess>' +
    '</cas:serviceResponse>';

  return res;
}

var getFailResponse = function(st) {
  var res = '<cas:serviceResponse xmlns:cas=\'http://www.yale.edu/tp/cas\'>' +
    '<cas:authenticationFailure code=\'INVALID_TICKET\'>' +
    '未能够识别出目标 &#039;' + st + '&#039;票根' +
    '</cas:authenticationFailure>' +
    '</cas:serviceResponse>';

  return res;
};

function getSuccessProxyResponse(pt) {
  var res = "\
\
    <cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>\
    <cas:proxySuccess>\
  <cas:proxyTicket>" + pt + "</cas:proxyTicket>\
  </cas:proxySuccess>\
  </cas:serviceResponse>";

  return res;
}

var getFailProxyResponse = function(status, pgtId) {
  var res = '';
  pgtId = pgtId || 'TGT--EiiRpxOYfq2PZNjK7jBMiID9Wy55YUFRvVNLXbKDXZNQtXVpjn-login.rdm.org';
  switch (status) {
    case 'success':
      res = "\
\
\
        <cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>\
      <cas:proxySuccess>\
    <cas:proxyTicket>ST-77742-NZGCCAKlSCwLfaVBhpch-login.rdm.org</cas:proxyTicket>\
    </cas:proxySuccess>\
    </cas:serviceResponse>";
      break;
    case 'invalidPgt':
      res = "\
\
\
        <cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>\
      <cas:proxyFailure code='INVALID_TICKET'>\
      未能够识别出目标 &#039;" + pgtId + "&#039;票根\
    </cas:proxyFailure>\
    </cas:serviceResponse>";
      break;
    case 'emptyPgt':
      res = "\
\
\
        <cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>\
      <cas:proxyFailure code='INVALID_REQUEST'>\
      必须同时提供&#039;pgt&#039;和&#039;targetService&#039;参数\
    </cas:proxyFailure>\
    </cas:serviceResponse>";
      break;
    case 'emptyRequest':
    case 'emptyTargetService':
    default:
      res = "\
\
\
        <cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>\
      <cas:proxyFailure code='INVALID_REQUEST'>\
      必须同时提供&#039;pgt&#039;和&#039;targetService&#039;参数\
    </cas:proxyFailure>\
    </cas:serviceResponse>";
      break;
  }

  return res;
};

var getRestletIntegrationPGT = function(pgt) {
  pgt = pgt || 'TGT-2-c9av4cPM1ig7e5DZEiCBZjAATXspVuoDZVqDkvo9aSJabRReb-login.rdm.org';
  var res = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\
    <html>\
    <head>\
    <title>201 The requesst has been fulfilled and resulted in a new resource being created</title>\
  </head>\
  <body>\
  <h1>TGT Created</h1>\
  <form action="http://remdev.oa.com/buglycas/vi/tickets/' + pgt + '" method="POST">Service:\
  <input type="text" name="service" value="">\
    <br>\
    <input type="submit" value="Submit">\
    </form>\
    </body>\
    </html>';

  return res;
};

function initTgt() {
  return {
    st: {},
    pt: {}
  };
}

function initTicket(service) {
  return {
    valid: true,
    service: service
  }
}

/**
 *
 * @param {Express} app
 * @param options
 * @param {Number} options.expectStatus
 * @param {String} options.expectStatusStr   Supported: fail, invalid
 * @param {*}      options.expectResponse
 * @returns {*}
 */
module.exports = function(app, options) {

  var tgts = {};

  options = options || {
      expectStatus: 200
    };

  options.expectStatus = options.expectStatus || 200;

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  var MemoryStore = require('session-memory-store')(session);

  app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: 'I am a secret',
    name: 'jssessionid',
    store: new MemoryStore()
  }));

  app.get('/cas/serviceValidate', function(req, res) {
    if (options.expectStatus == 200) {
      if (options.expectStatusStr === 'fail') {
        res.status(200).send(getFailResponse('xxx'));
      } else if (options.expectStatusStr === 'invalid') {
        res.status(200).send('i am a invalid xml');
      } else {
        if (req.query) {
          if (!req.query.ticket || !req.query.service) {
            return res.send(getFailResponse('xxx'));
          }

          var ticket = req.query.ticket,
            service = req.query.service;

          var finded = false;

          var tgt, tgtId;

          outer:
            for (var i in tgts) {
              for (var j in tgts[i].st) {
                if (j === ticket && tgts[i].st[j].valid && tgts[i].st[j].service === service) {
                  finded = true;
                  tgts[i].st[j].valid = false;
                  tgt = tgts[i];
                  tgtId = i;
                  break outer;
                }
              }
            }

          if (!finded) return res.send(getFailResponse(ticket));

          var pgtIou = uuid.v4();

          if (req.query.pgtUrl) {
            // console.log('cas server: sending request to ', req.query.pgtUrl);
            utils.getRequest(req.query.pgtUrl, {
              params: {
                pgtId: tgtId,
                pgtIou: pgtIou
              }
            }, function(err, response) {
              if (err) {
                console.error('Error when sending request to pgtUrl', err);
              }

              res.send(getSuccessResponse(pgtIou));
            });
          } else {
            res.send(getSuccessResponse());
          }
        }
      }
    } else {
      res.sendStatus(options.expectStatus);
    }
  });

  app.get('/cas/proxy', function(req, res) {
    if (req.query) {
      if (!req.query.pgt) {
        res.send(getFailProxyResponse('emptyPgt'));
      } else if (!req.query.targetService) {
        res.send(getFailProxyResponse('emptyTargetService'));
      } else {
        if (req.query.targetService === 'invalid') {
          res.send(getFailProxyResponse('emptyTargetService'));
        } else if (req.query.pgt in tgts || req.query.pgt === 'fakePgtId') {
          var pt = uuid.v4();

          res.send(getSuccessProxyResponse(pt));
        } else {
          res.send(getFailProxyResponse('invalidPgt', req.query.pgt));
        }
        // if (req.query.pgt === pgtId || req.query.pgt === 'fakePgtId') {
        //   var pt = uuid.v4();
        //
        //   res.send(getSuccessProxyResponse(pt));
        // } else {
        //   res.send(getFailProxyResponse('invalidPgt', req.query.pgt));
        // }
      }
    } else {
      res.send(getFailProxyResponse('emptyRequest'))
    }
  });

  app.get('/cas/login', function(req, res) {
    if (req.query && req.query.service) {
      var pgtId = uuid.v4();

      tgts[pgtId] = initTgt();

      var st = uuid.v4();

      tgts[pgtId].st[st] = initTicket(req.query.service);

      var path = decodeURIComponent(req.query.service);

      var uri = url.parse(path, true);

      if (!uri.query) uri.query = {};

      uri.query.ticket = st;

      res.redirect(302, url.format(uri));
    } else {
      res.send('ok');
    }
  });

  app.get('/cas/logout', function(req, res) {

  });

  app.post('/cas/v1/tickets', function(req, res) {

    var username = 'username',
      passworld = 'password',
      type = 8;

    if (req.body && req.body.username === username && req.body.type == type && req.body.password === passworld) {
      var pgtId = uuid.v4();

      tgts[pgtId] = initTgt();

      res.send(getRestletIntegrationPGT(pgtId));
    } else {
      res.sendStatus(400);
    }
  });

  app.delete('/cas/v1/tickets/:tgt', function(req, res) {
    if (req.params && req.params.tgt && (req.params.tgt in tgts)) {
      delete tgts[req.params.tgt];
    }
    res.sendStatus(200);
  });

  app.get('/cas/v1/tickets', function(req, res) {
    res.send(JSON.stringify(tgts));
  });

  return app;
};
