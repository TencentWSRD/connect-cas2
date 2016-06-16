# connect-cas2

CAS Client NodeJS implement，support CAS 2.0+ protocol.

Totally restructured from my another project [nodejs-cas](https://npmjs.com/package/nodejs-cas).

## VERSION

1.1.0-beta

## Install

    npm install connect-cas2
            
## Quick start

```javascript
var express = require('express');
var ConnectCas = require('connect-cas2');
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
      filter: []
    },
    fromAjax: {
      header: 'x-client-ajax',
      status: 418
    }
});

app.use(casClient.core());
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

The path of your CAS server. For example: https://www.your-cas-server-path.com/cas

#### options.servicePrefix {String} (Required)

The root path of your CAS client(Your website).

Every paths that for your CAS client will use this path as the root path.

For example: We will send `${options.servicePrefix}${options.paths.validate}` as `service` parameter to the login page. Then after login CAS server will redirect to `${options.servicePrefix}${options.paths.validate}` to validate the ST.

#### options.ignore {Array} (Optional, default: [])

In some cases, you don't need all request to be authenticated by the CAS. So you can set the ignore rules, when some rules matched, we will simply call the `next()` function and do nothing.

We support String rules, RegExp rules and Function rules.

For example, we checked the rules like:

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
if (funcRule(req.path, req)) next();
```

#### options.match {Array} (Optional, default: [])
If you set this option, only the paths that matched one of the rules will go into CAS middleware. All rules works just like `options.ignore`.

#### options.paths {Object} (Optional, default: {})
Relative paths to specific all functional paths to the CAS protocol. If you havn't modified the APIs of your CAS server, you may don't need to set this option. (In proxy mode, you must set the options.paths.proxyCall)

#### options.paths.validate (String) (Optional, default: '/cas/validate')
(For CAS Client)

The path you want your CAS client to validate ST from the CAS server. And we'll use `${options.servicePrefix}${options.paths.validate}` as `service` parameter to any CAS server's APIs that need this `service`.

#### options.paths.serviceValidate (String) (Optional, default: '/cas/serviceValidate')
(For CAS Server)

The path your CAS Server validate a ST. CAS client will send request to `${options.servicePrefix}${options.paths.serviceValidate}` to validate a ST.

#### options.paths.proxy (String) (Optional, default: '/cas/proxy')
(For CAS Server)

In proxy mode, you need a PGT(proxy granting ticket) to communicate with other server, you can get a PGT form this path: `${options.servicePrefix}${options.paths.proxy}`.

#### options.paths.login (String) (Optional, default: '/cas/login')
(For CAS Server)

The login path of your CAS server.

#### options.paths.logout (String) (Optional, default: '/cas/logout')
(For CAS Server)

The logout path of your CAS server.

#### options.paths.proxyCallback (String) (Optional, default: '')
(For CAS Client)
In proxy mode, setting this path means you want this path of your CAS Client to receive the callback from CAS Server(Proxy mode) to receive the PGTIOU and PGTID.

In none-proxy mode, don't set this option!

#### options.fromAjax {Object} (Optional, default: {})
Because an AJAX request can't notice 302 redirect response, and will directly redirect without telling you anything.

So when your user's authentication is expired, and your CAS Client and CAS Server is not in the same domain, (In most cases they won't be the same domain) when they send an AJAX request, oops, an not-allowed-cross-domain exception will occur!

To prevent this embarrassing situation, we add this option.

#### options.fromAjax.header {String} (Optional, default: 'x-client-ajax')
CAS will assume all request with header: 'x-client-ajax' is an AJAX request, so when user's authentication expired, CAS won't redirect to the login page, but send back the specified status code that you set as `options.fromAjax.status`.

#### options.fromAjax.status {Number} (Optional, default: 418)
As introduced before, when user's authentication expired, CAS won't redirect to the login page, but send back this as http status code.

For example:

    options.fromAjax = {
       header: 'x-client-ajax',
       status: 418
    };

So what you need to do in your browser code is you should handle this situation, when status code is 418, you should do `window.location.reload()` or something else to let your user reauthenticate.

#### options.debug {Boolean} (Optional, default: false)
For debug usage, we will log every step when CAS client is interacting with CAS server.

#### options.redirect(req, res) {Function} (Optional, default: null)
Change the default behaviour that after user login or login failed, CAS redirect to the last url.

If you return `true` from this redirect function, then CAS won't redirect to the last url, (So make sure you send a response in your function.)
otherwise, CAS just keep the same logic that will redirect to the last url after user login or login failed.

#### options.cache {Object} (Optional) `Since v1.1.0-beta`
Works in PROXY-MODE ONLY!

If you don't want to request a proxy-ticket every time you interact with your server, you can set this options to `enable=true`.
(NOTICE!! You must make sure the server you want to interact already set the PT cacheable, or using an PT that cached in your CAS client won't work!)

#### options.cache.enable {Boolean} (Optional, defualt: false)

#### options.cache.ttl {Number} (Optional, default: 300000 , in millisecond )
How long will the PT be cached.

#### options.cache.filter {Array} (Optinal, default: [])
In some cases, not every servers you want to interact enabled cacheable PT, so you can set the filter rules here, if one rule matchs the service url, it's PT won't be cached.

Every rule works like the `options.ignore`.

### METHOD

#### casClient.core()

Return a middleware that handles all the CAS client logic.

Use as `app.use(casClient.core())`.

#### casClient.logout()
Return a middleware that handles the logout action.

Use it like `app.get('/logout', casClient.logout())`. It will destroy the session of current user and then redirect to the CAS server logout page.

#### req.getProxyTicket(servicePath, [disableCache], callback)
If you setup options.paths.proxyCallback, CAS middleware will add a function called `getProxyTicket` on the request object, so you can access that by callback `req.getProxyTicket`.

`servicePath` is the service path you want to interact with.

`disableCache` {Boolean} (optional) When you setup PT cache, then you get a cached PT from `getProxyTicket`, but somehow the service validate this cached PT failed. In that case, you need to call this function again with setting this param to `true`.

`callback(err, pt)`

Example:
```javascript
   app.get('/api', function(req, res) {
     var service = 'http://your-service.com';
     req.getProxyTicket(service + '/cas', function(err, pt) {
       if (err) return res.status(401).send('Error when requesting PT, Authentication failed!');

       request.get(service + '/api/someapi?ticket=' + 'pt', function(err, response) {
          res.send(response);
       });
     });
   });
```

### PROXY MODE
In proxy mode, before you want to interact with your server, you need to request a ticket from CAS server.

### NONE-PROXY MODE
In none-proxy mode, don't set options.paths.proxyCallback, when all middle-ware passed, that means the login succeed.

## CHANGE LOG

#### 1.1.0-beta
Add `cache proxy ticket` feature.

#### 1.0.0-beta
Restructured from [nodejs-cas](https://npmjs.com/package/nodejs-cas).

## More

Currently we use this project in our production environment, and it works fine with our CAS Server. If you're facing any issues, please make us know!

## License

  MIT
