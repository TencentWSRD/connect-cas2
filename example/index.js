var path = require('path');
var http = require('http');
var process = require('process');
var Express = require('express');
var session = require('express-session');

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var CasClient = require('../index');
var ejs = require('ejs');
var morgan = require('morgan');

var app = new Express();

app.use(morgan('dev'));
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

// CAS config
// =============================================================================
var casClient = new CasClient({
  debug: true,
  ignore: [
    /\/ignore/
  ],
  match: [],
  servicePrefix: 'http://10.17.86.87:8080',
  serverPath: 'http://rdmdev.oa.com',
  paths: {
    validate: '/cas/validate',
    serviceValidate: '/buglycas/serviceValidate',
    proxy: '/buglycas/proxy',
    login: '/buglycas/login',
    logout: '/buglycas/logout',
    proxyCallback: 'http://10.17.86.87:8080/buglycas/proxyCallback',
    restletIntegration: '/buglycas/v1/tickets'
  },
  redirect: false,
  gateway: false,
  renew: false,
  ssoff: true,
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
  restletIntegration: {
    demo1: {
      trigger: function(req) {
        console.log('Checking restletIntegration rules');
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
});

app.use(casClient.core());
app.get('/logout', casClient.logout());

app.get('/', function(req, res) {
  res.render('index.ejs');
});


app.get('/api', function(req, res) {
  var service = 'http://betaserverpre.et.wsd.com/betaserverv2';
  req.getProxyTicket(service + '/shiro-cas', function(err, pt) {
    if (err) {
      console.log('getProxyTicket error');
      console.log(err);
      return res.status(500).send(JSON.stringify(err));
    }

    console.log('sending request to ', service + '/file/4d6960ff-c11f-4ba8-baed-af1a2f95bffe/info?' + require('query-string').stringify({
        ticket: pt
      }));

    require('../lib/utils').getRequest(service + '/file/4d6960ff-c11f-4ba8-baed-af1a2f95bffe/info?' + require('query-string').stringify({
        ticket: pt
      }), function(err, response) {
      res.send(response);
    });
  })
});

app.get('/clear', function(req, res) {
  req.clearRestlet();
  console.log('this means it is sync!');
  res.send('ok');
});

var server = http.createServer(app);


server.listen(8080, function(err) {
  if (err) throw err;
  console.log('App is now listening to port 8080.');
});

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, err) {
  if (options.cleanup) console.log('clean');
  if (err) console.log(err.stack);
  if (options.exit) process.exit();
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));

process.on('SIGINT', exitHandler.bind(null, { exit: true }));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));


var obj = {
  "http://ciserver.et.wsd.com/ciserver3.0": true,
  "http://processservice.et.wsd.com/processservice": false,
  "http://svnmanage.sdet.wsd.com/svnmange": false,
  "http://productserver.et.wsd.com/productserver": false,
  "http://cimonitor.et.wsd.com/monitorserver": false
};
