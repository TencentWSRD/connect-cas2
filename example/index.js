var path = require('path');
var Express = require('express');
var session = require('express-session');

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
// import flash = 'express-flash';
var CasClient = require('../index');
var ejs = require('ejs');
var morgan = require('morgan');
// import ejs from 'ejs';

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
app.use(CasClient({
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
  fromAjax: {
    header: 'x-client-ajax',
    status: 418
  }
}));

app.get('/', function(req, res) {
  res.render('index.ejs');
});

app.get('/logout', function(req, res) {
  if (!req.session) {
    return res.redirect('/');
  }
  // Forget our own login session

  if (req.session.destroy) {
    req.session.destroy();
  } else {
    // Cookie-based sessions have no destroy()
    req.session = null;
  }

// Send the user to the official campus-wide logout URL
  const options = cas.options;

  return res.redirect(options.path + options.paths.logout + '?service=' + encodeURIComponent(options.servicePrefix + options.paths.validate));
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