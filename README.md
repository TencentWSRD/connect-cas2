# node-cas-client
forked from [connect-cas2](https://github.com/TencentWSRD/connect-cas2) and add some configure : 
```javascript
var casClient = new ConnectCas({
    requestCert: false,
    rejectUnauthorized: true
})
```

A complete implement of CAS Client middleware for Express/Connect, support CAS 2.0+ protocol.

CAS(Central Authentication Service) is a single-sign-on / single-sign-off protocol for the web.

We suppose you are already familiar with the CAS protocol, if not, please read this [document](https://github.com/zimplexing/node-cas-client/blob/master/README.zh.md) before you use this.

[中文文档](https://github.com/zimplexing/node-cas-client/blob/master/README.zh.md)

## Install

    npm install node-cas-client

## Feature

1. Non-proxy mode CAS login/logout
2. Proxy mode CAS login/logout, get proxy ticket
3. Single sign off
4. Restlet integration supported

## Quick start

Notice:

1. You must use `express-session` middleware before the casClient.core() middleware.
2. If you want to enable slo(single sign logout) feature, you need to use casClient.core() middleware before `bodyParser`, because the SLO need to access a POST request's raw body from CAS server.

```javascript
var express = require('express');
var ConnectCas = require('node-cas-client');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var MemoryStore = require('session-memory-store')(session);

var app = express();

app.use(cookieParser());
app.use(session({
  name: 'NSESSIONID',
  secret: 'Hello I am a long long long secret',
  store: new MemoryStore()  // or other session store
}));

var casClient = new ConnectCas({
  debug: true,
    ignore: [
      /\/ignore/
    ],
    match: [],
    servicePrefix: 'http://localhost:3000',
    serverPath: 'http://your-cas-server.com',
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
    slo: true,
    cache: {
      enable: false,
      ttl: 5 * 60 * 1000,
      filter: []
    },
    fromAjax: {
      header: 'x-client-ajax',
      status: 418
    }
});

app.use(casClient.core());

// NOTICE: If you want to enable single sign logout, you must use casClient middleware before bodyParser.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/logout', casClient.logout());

// or do some logic yourself
app.get('/logout', function(req, res, next) {
  // Do whatever you like here, then call the logout middleware
  casClient.logout()(req, res, next);
});
```

## Constructor

```javascript

var casClient = new CasClient(options);

```

### options

#### options.serverPath {String} (Required)

The root path of your CAS server. For example: https://www.your-cas-server-path.com

For example: If you set `options.paths.login` to '/cas/login', `options.serverPath` to 'https://www.your-cas-server-path.com', then the CAS server login path will be 'https://www.your-cas-server-path.com/cas/login'.

#### options.servicePrefix {String} (Required)

The root path of your CAS client(Your website root).

Every paths that for your CAS client will use this path as the root path.

For example: If you set `options.paths.validate` to '/cas/validate', `options.servicePrefix` to 'http://localhost:3000', then the client side validate path will be 'http://localhost:3000/cas/validate'.

#### options.ignore {Array} (Optional, default: [])

In some cases, you don't need all request to be authenticated by CAS. So you can set the ignore rules, when some rules matched, the casClient.core middleware will go next and do nothing.

Rules here support String/RegExp/Function.

Under the hook, we checked the rules like:

1. String rules:

```javascript
if (req.path.indexOf(stringRule) > -1) next();
```

2. Reg rules:

```javascript
if (regRule.test(req.path)) next();
```

3. Function rules:
```javascript
if (functionRule(req.path, req)) next();
```

So you could config which specific path you need to ignore by the CAS authentication.

#### options.match {Array} (Optional, default: []) (Not recommend)
If you set this option, only the paths that matched one of the rules will go into CAS middleware.

All rules works as above.

#### options.paths {Object} (Optional)
Relative paths to all functional paths for the CAS protocol.

All paths for CAS Server is depending on your CAS server.

#### options.paths.validate (String) (Optional, default: '/cas/validate')
(For CAS Client)

The path you want your CAS client to validate a ticket from CAS server.

We'll use `${options.servicePrefix}${options.paths.validate}` as `service` parameter to any CAS server's APIs that need this parameter, for example: casServer/cas/login, casServer/cas/serviceValidate,

#### options.paths.proxyCallback (String) (Optional, default: '')
(For CAS Client)

In proxy mode, setting this path means you want this path of your CAS Client to receive the callback from CAS Server(Proxy mode) to receive the PGTIOU and PGTID.

This could be a relative path like the others, or it can also be a absolute path.

In none-proxy mode, don't set this option!

[Read this for more information about proxy mode](https://github.com/apereo/cas/blob/master/cas-server-documentation/protocol/CAS-Protocol-Specification.md#254-proxy-callback)

#### options.paths.serviceValidate (String) (Optional, default: '/cas/serviceValidate')
(For CAS Server)

The path your CAS Server validate a ticket(ST).

#### options.paths.proxy (String) (Optional, default: '/cas/proxy')
(For CAS Server)

The path we'll ask CAS Server to get a PT(proxy ticket) to communicate with any other back-end service.

#### options.paths.login (String) (Optional, default: '/cas/login')
(For CAS Server)

The login path of your CAS server.

#### options.paths.logout (String) (Optional, default: '/cas/logout')
(For CAS Server)

The logout path of your CAS server.

#### options.paths.restletIntegration (String) (Optional, default: '')
(For CAS Server)

The restlet integration api of your CAS Server. Set up this option only if you need to use restlet integration.

#### options.fromAjax {Object} (Optional, default: {})
When your user's authentication is expired, all request send to CAS client will redirect to the CAS login path.

So image this situation, when you're sending an Ajax request to a CAS client, meanwhile your authentication is expired, besides your CAS Client and CAS Server is not in the same domain, an CROS error will happen.

This situation is difficult to handle, because an AJAX request can't notice 302 redirect response, and it will directly redirect without telling you anything.

And for the reason of preventing this embarrassing situation, we add this option.

#### options.fromAjax.header {String} (Optional, default: 'x-client-ajax')
CAS will assume all request with header: 'x-client-ajax' is an AJAX request, so when user's authentication expired, CAS won't redirect to the login page, but send back the specified http status code that you set as `options.fromAjax.status`.

For example:

If you set `options.fromAjax.header` to 'x-client-ajax', you should add a header like: 'x-client-ajax: 1' to your request, and CAS client will notice that this is an AJAX request.

#### options.fromAjax.status {Number} (Optional, default: 418)
As introduced before, when user's authentication expired, CAS won't redirect to the login page, but send back this as http status code.

For example:

    options.fromAjax = {
       header: 'x-client-ajax',
       status: 418
    };

So what you need to do in your browser's code is:

1. Add `'x-client-ajax': 1` header on all your AJAX request header
2. You should handle this situation, when the response status code is 418, you should do `window.location.reload()` or something else to let your user reauthenticate.

#### options.debug {Boolean} (Deprecated)
Because CAS protocol is complicated, we remove this option. We recommend you to always log every step that what CAS client do on your production environment.

In production environment, it's recommended to setup your own logger by options.logger.

#### options.redirect(req, res) {Function} (Optional, default: null)
The default behaviour that when a user login or login failed, CAS client will redirect the user to the last url the user visited.

Setting up this option to change this behavior, if you return a none-empty string from this redirect function, then CAS won't redirect to the last url, but the url you returned.

For example, on some pages, you don't want redirect the user to the login page after they logout.

By default, after a user logout, CAS client will redirect the user to `${serverPath}${paths.logout}?service=${servicePrefix}${paths.validate}`, and after logout on CAS server,
it will redirect to `${servicePrefix}${paths.validate}`, then redirect to `${serverPath}${paths.login}` to let the user to login again.

So, on those pages, you can set a key in cookies when your user want to logout, then check this value in cookie in the `options.redirect` function, if match, return `true` in that function and redirect the user to wherever you want.

(NOTICE: The only reason that we pass `res` in this function is give you a way to access the response cookie, please don't send any request via this Response object)

```javascript

var options = {
  redirect: function(req, res) {
    if (req.cookies.logoutFrom) {
      // When need to redirect to specific location, return the location you want to redirect.
      return url.parse(req.cookies.logoutFrom).pathname;
    }
  }
};

var casClient = new CasClient(options)

app.get('/logout', function(req, res) {
  var fromWhere = req.get('Referer');
  var fromWhereUri = url.parse(fromWhere);
  if (fromWhereUri.pathname.match(/the page you dont want user to login after logout/)) {
    res.cookie('logoutFrom', fromWhereUri.pathname);
  }
  casClient.logout()(req, res);
});

````

#### options.cache {Object} (Optional) `Since v1.1.0-beta`
(Works in PROXY-MODE ONLY)

If your back-end service already enable PT cache, you can set options to `options.cache.enable=true`, then before this PT expired, CAS client will use this PT directly and won't request to /cas/proxy to fetch a new one.

Be aware that the ttl of your cache PT should be shorter than that on your back-end service.

When a PT is expired on your service but is still available on your client, using that expired PT to request to you back-end service, you will receive response status code of 401.

In case of this situation, you should check the response code from your back-end service, when it's 401, manually refetch a new PT by calling `req.getProxyTicket(targetService, {renew: true}, callback)`.

For more example, see the `req.getProxyTicket` below.

(NOTICE!! You must make sure the server you want to interact already set the PT cacheable, otherwise using an PT that cached in your CAS client only won't work!)

#### options.cache.enable {Boolean} (Optional, defualt: false)
As said above, set this to `true` will enable the PT cache, make sure your back-end service already enable the PT cache.

#### options.cache.ttl {Number} (Optional, default: 300000 , in millisecond )
How long will the PT be expired, should be shorter than that on your back-end service.

#### options.cache.filter {Array} (Optinal, default: [])
In some cases, not every servers you want to interacted have enabled PT cache, so you can set the filter rules here, if one rule matchs the service url, it's PT won't be cached.

Every rule works like the `options.ignore`. If any rules matched, CAS client will request a new PT when you call `req.getProxyTicket`.

#### options.restletIntegration {Object} (Optional, defualt: {})
Setting up your CAS restlet integration.

Example:

```javascript
options.restletIntegration: {
  demo1: {
    trigger: function(req) {
      // Decision whether to use restlet integration, when matched, return true.
      // Then CAS will not force the user to login, but can get a PT and interacted with the specific back-end service that support restlet integration by a special PGT. 
      // return false
    },
    // Parameters that will send to CAS server to get a special PGT
    params: {
      username: 'restlet username',
      from: 'http://localhost:3000/cas/validate',
      password: 'restlet password'
    }
  }
}
```

#### options.hooks {Object} (Optional, since v1.1.24)
Hooks, we currently provide two hook functions, one is before CAS client logic is invoked, one is after. They're all called like a middleware.

#### options.hooks.before {Function}
Before CAS-invoked hook function, it will be called like `options.hooks.before(req, res, next)`. You could set a timestamp in it or do anything you like in the hook function(Don't forget to call `next()`).

#### options.hooks.after {Function}
This hook function will be called when all logic that `casClient.core()` middleware is done, it will be called like a middleware: `options.hooks.after(req, res, next)`, so don't forget to call `next()`.

#### options.logger {Function} (Optional)
Customized logger factory function. Will be called like: `logger(req, type)`, `req` is the Response object, and the type is one of these log types: 'log', 'error', 'warn'.

The logger factory should return a log function, for example: `options.logger = (req, type) => return console[type].bind(console[type])`

In production environment, maybe you want to customize the format/content/output of the log by using log4js/winston and so on.

In our cases, we also print the user information in each log for convenient to trace issues, that's why we pass `req` object to the factory function.

Here's how we setup our production environment's log:

```javascript
app.use((req, res, next) => {
  req.sn = uuid.v4();
  function getLogger(type = 'log', ...args) {
    let user = 'unknown';
    try {
      user = req.session.cas.user;
    } catch(e) {}

    return console[type].bind(console[type], `${req.sn}|${user}|${req.ip}|`, ...args);
  }

  req.getLogger = getLogger;
});

var casClient = new CasClient({
  logger: (req, type) => {
    return req.getLogger(type, '[CONNECT_CAS]: ');
  }
});

app.use(casClient.core());

```

### METHOD

#### casClient.core()

Return a middleware that handles all the CAS client logic.

Use as `app.use(casClient.core())`.

#### casClient.logout()
Return a middleware that handles the logout action.

Use it like `app.get('/logout', casClient.logout())`. It will destroy the session of current user and then redirect to the CAS server logout page.

In most cases, you want to do something else before actually logout, so use it like:

```javascript
  app.get('/logout', function(req, res) {
    // Do your logic here, then call the logout middle
    casClient.logout()(req, res)
  });

```

#### req.getProxyTicket(targetService, [proxyOptions], callback)
After using casClient.core() middleware, you can access a `getProxyTicket` function via the `req` object.

When you're using proxy-mode, you can use this method to get a PT to interacted to another back-end service.

(Notice: if you're not in proxy-mode, calling this method it will directly call the callback and returns nothing.)

`targetService` is the absolute back-end service path you want to interact with. You should know that which CAS client that your back-end service is using, this path should be their validate path.
For example, if they're using node-cas-client too, this should be their `${options.servicePrefix}${options.paths.validate}`.

`proxyOptions` {Object}        (Optional) Options.

`proxyOptions.disableCache`    {Boolean} If set to true, it will ignore the cached PT(If you enable PT cache) and to request a new one.
`proxyOptions.renew`           {Boolean} If set to true, it will ignore the cached PT(If you enable PT cache) and to request a new one, then set this to cache.

Example:
```javascript
   app.get('/api', function(req, res) {
     var service = 'http://your-service.com';
     req.getProxyTicket(service + '/cas', function ptCallback(err, pt) {
       if (err) return res.status(401).send('Error when requesting PT, Authentication failed!');

       request.get(service + '/api/someapi?ticket=' + 'pt', function (err, response) {
          if (err) return res.sendStatus(500);

          // If you enable PT cache, and they're expired on your back-end service
          if (response.status == 401) {
            // Be carefule the retry loop
            return req.getProxyTicket(service + '/cas', {renew: true}, ptCallback);
          }

          res.send(response);
       });
     });
   });
```

## CHANGE LOG
[CHANGE LOG](https://github.com/zimplexing/node-cas-client/blob/master/CHANGELOG.md)

## More

Currently we use this project in our production environment, and it works fine with our CAS Server. If you're facing any issues, please make us know!

## License

  MIT
