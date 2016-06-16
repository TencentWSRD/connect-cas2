var path = require('path');
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
    proxyCallback: '/buglycas/proxyCallback'
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

    require('../lib/utils').getRequest(service + '/file/4d6960ff-c11f-4ba8-baed-af1a2f95bffe/info?' + require('query-string').stringify({
        ticket: pt
      }), function(err, response) {
      res.send(response);
    });
  })
});


app.listen(8080, function(err) {
  if (err) throw err;
  console.log('App is now listening to port 8080.');
});