# nodejs-cas

CAS Client NodeJS implement，support CAS 2.0+ protocol.

Adapted from https://github.com/acemetrix/connect-cas。

## VERSION

1.0.11

## Install

    npm install nodejs-cas
            
## Quick start

```javascript
var express = require('express');
var CasClient = require('nodejs-cas');
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

var cas = new CasClient({
  path: 'https://cas.xx.com/cas',
  ajaxHeader: 'x-client-fetch',
  servicePrefix: 'http://your.service.path.com',

  ignore: [
    function(path, req) {
      return path.indexOf('somePathYourWantToIgnore') > -1;
    },
    'static/style.css',
    /static\/*/
  ],
  paths: {
    validate: '/cas/validate',
    serviceValidate: '/cas/serviceValidate',
    proxy: '/cas/proxy',
    login: '/cas/login',
    logout: '/cas/logout',
    proxyCallback: '/cas/proxyCallback'
  }
})

app.use(cas.serviceValidate())
  .use(cas.ssout())  // Only if you need to SSOFF(single sign off)
  .use(cas.authenticate());

app.get('/logout', function (req, res) {
  if (!req.session) {
    return res.redirect('/');
  }

  req.session.destroy();

  var options = cas.options;

  return res.redirect(options.path + options.paths.logout + '?service=' + encodeURIComponent('http://your.service.path.com'));
});
```

## Constructor

```javascript

var casClient = new CasClient(options);

```

### options

#### options.path {String} (Required)

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

#### options.ajaxHeader {String} (Optional, default: '')
Because an AJAX request can't notice 302 redirect response, and will directly redirect under the hook without telling you anything.

So when your user's authentication is expired, and your CAS Client and CAS Server is not in the same domain, (In most cases they won't be the same domain) when they send an AJAX request, oops, an not-allowed-cross-domain exception will occur!

To prevent this embarrassing situation, we add this option. So send all AJAX request with the header you set.

For example: options.ajaxHeader = 'x-client-ajax', then send header: x-client-ajax=true with the AJAX request.

Then we'll know this request is an AJAX request, and when the authentication is expired, we will send a `418` TEAPOT statusCode other than `302` to the login page, you need to handle this status code, and tell your user to refresh the page or what to do.

#### options.debug {Boolean} (Optional, default: false)
For debug usage, we will log every step when CAS client is interacting with CAS server.

#### options.redirect(req, res) {Function} (Optional, default: null)
Change the default behaviour that after user login or login failed, CAS redirect to the last url.

If you return `true` from this redirect function, then CAS won't redirect to the last url, (So make sure you send a response in your function.)
otherwise, CAS just keep the same logic that will redirect to the last url after user login or login failed.

### METHOD

#### CasClient.proxyTicket(pgt, targetService, callback)

In proxy mode, request a ticket from CAS server to interact with targetService.

You can receive the ticket by passing a callback function which will be called like: `callback(error, ticket)`, besides, CasClient.proxyTicket will also return a promise,
when resolved, it will pass `ticket` to the resolve function, then you can send it as ticket parameter to request to the other server.

Example:
```javascript
    // In promise way
    CasClient.proxyTicketPromise(req.session.pgt, 'http://your-target-service.com')
      .then(function(ticket) {
        // Then you can send reqeust with parameter ticket http://your-target-service.com/some/path?ticket=${ticket}
      })
      .catch(function(err) {
        throw err
      });

    // or callback
    CasClient.proxyTicketPromise(req.session.pgt, 'http://your-target-service.com', function(error, ticket) {
      if (error) throw error;
      // Then you can send reqeust with parameter ticket http://your-target-service.com/some/path?ticket=${ticket}
    });
```

### PROXY MODE
In proxy mode, at first you need to set options.paths.proxyCallback, when the proxy-mode-login is finished, you can access a value called `pgt` on req.session.pgt.

By using this `pgt`, you can get a ticket from CAS server by calling `CasClient.proxyTicket`.

### NONE-PROXY MODE
In none-proxy mode, don't set options.paths.proxyCallback, when all middle-ware passed, that means the login succeed.

## CHANGE LOG

#### 1.0.10
Add new option `redirect`, to change the default logic that CAS will redirect to the last url after login. 

#### 1.0.2
Restructure code, use constructor to initialize CasClient, change some options.

#### From 0.2.x to 1.0.x
In 1.0.x, you need to new an CAS-Client instance instead of calling them as static method in 0.2.x. We change options a lot to make it more easier to config and use.

We remove the 'other domain proxyCallback' feature and custom 'pgtFn' which you can handle pgtIou and pgtId yourself, because we find out that we can rarely use them and it'll make it more complicated to understand and use if you're not familiar with CAS Protocol.

We combined the static functions: proxyTicketPromise and proxyTicket into one function `proxyTicket` which can both use a promise way or callback way.

## More

Currently we use this project in our production environment, and it works fine with our CAS Server. If you're facing any issues, please make us know!

## License

  MIT
