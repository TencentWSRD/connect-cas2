[![Build Status](https://travis-ci.org/TencentWSRD/connect-cas2.svg?branch=master)](https://travis-ci.org/TencentWSRD/connect-cas2)
[![Coverage Status](https://coveralls.io/repos/github/TencentWSRD/connect-cas2/badge.svg?branch=master)](https://coveralls.io/github/TencentWSRD/connect-cas2?branch=master)

# connect-cas2

一个完整的CAS Client NodeJS实现，支持CAS 2.0+ 协议。

CAS(Central Authentication Service) 是一个单点登录/登出的协议，下面的文档我们假设您已经对CAS比较熟悉，否则请先查看下CAS协议的[介绍文档](https://github.com/apereo/cas/blob/master/cas-server-documentation/protocol/CAS-Protocol-Specification.md)。

[English version document](https://github.com/TencentWSRD/connect-cas2/blob/master/README.md)

## Install

    npm install connect-cas2

## 特性

1. 非代理模型下的CAS协议的登入、登出
2. 代理模型下的CAS协议登入、登出、换取PT票据
3. 单点登出
4. Restlet integration

## 快速开始

注意：

1. 务必在使用casClient.core()中间件之前初始化session
2. 如果需要启用单点登出，并且您使用了bodyParser，那么必须在bodyParser之前使用casClient中间件。 因为CAS Client接收单点登出的请求需要拿到一个POST请求的RAW body，而在bodyParser之后并没有办法办到这个事情，因为bodyParser已经把请求拦截了。

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

你的CAS Server的根路径。 如: https://www.your-cas-server-path.com

例: 如果你的`options.paths.login='/cas/login'`, `options.serverPath='https://www.your-cas-server-path.com'`, 那么将跳转到CAS的登陆页面的路径会被拼为：'https://www.your-cas-server-path.com/cas/login'。

#### options.servicePrefix {String} (Required)

你网站的根路径。

例： 如果`options.paths.validate='/cas/validate'`， `options.servicePrefix='http://localhost:3000'`，那么你的client校验ticket的路径为： 'http://localhost:3000/cas/validate'。

#### options.ignore {Array} (Optional, default: [])

有些情况下，你并不想所有请求都走CAS校验。设置ignore的规则，当规则命中时，CAS会直接跳过。

支持的规则有String/RegExp/Function类型。

我们将会这样校验各种类型的规则：

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

#### options.match {Array} (Optional, default: []) (不推荐)
当设置这个选项时，仅有匹配规则的路由将会过CAS校验。不推荐使用。

规则设置同上。

#### options.paths {Object} (Optional)
CAS协议的各个路径配置， 包括CAS Client的和CAS Server的。

#### options.paths.validate (String) (Optional, default: '/cas/validate')
(CAS Client)

用于Client侧校验ST的路径。

我们将会使用`${options.servicePrefix}${options.paths.validate}`作为`service`参数的取值，所有需要service参数的CAS Server的接口都会使用这个取值，比如: casServer/cas/login, casServer/cas/serviceValidate。

#### options.paths.proxyCallback (String) (Optional, default: '')
(CAS Client)

在代理模型下，该路径用于CAS Client接受CAS Server的proxyCallback回调。该路径可以为相对路径或绝对路径（仅此配置支持绝对路径，因为某些场景下，可能CAS Server并不能直接通过域名访问CAS Client，此时可能需要配置为IP的绝对路径）

非代理模型下，请勿设置该选项。

如果你对代理模型与非代理模型有疑问，请[阅读文档](https://github.com/apereo/cas/blob/master/cas-server-documentation/protocol/CAS-Protocol-Specification.md#254-proxy-callback)获取更多信息。

#### options.paths.serviceValidate (String) (Optional, default: '/cas/serviceValidate')
(CAS Server)

CAS Server用于校验ticket的路径。

#### options.paths.proxy (String) (Optional, default: '/cas/proxy')
(CAS Server)

换取proxy ticket用于与其他后台服务交互的路径。

#### options.paths.login (String) (Optional, default: '/cas/login')
(CAS Server)

登陆的路径。

#### options.paths.logout (String) (Optional, default: '/cas/logout')
(CAS Server)

注销的路径。

#### options.fromAjax {Object} (Optional, default: {})
默认情况下，当用户身份过期时，CAS client会让用户302到登陆页面。但是当这个请求是一个AJAX请求时，AJAX并不能感知这个302，而是会直接访问302之后的路径，那么此时会有两种情况：

1. client与server同域，那么AJAX返回的将会是一个HTMl字符串（登录页面），然后直接JS解析报错。
2. client与server跨域，那么AJAX会直接报CROS的错

所以为了避免这种情况发生，增加了这个配置。

#### options.fromAjax.header {String} (Optional, default: 'x-client-ajax')
设置了这个配置后，CAS client会认为所有带有以这个字段为key的请求头的请求都是一个AJAX请求，此时如果用户身份过期，那么将不会返回302响应码，而是返回`options.fromAjax.status`的状态码。

#### options.fromAjax.status {Number} (Optional, default: 418)
如上所述，当判断是AJAX请求，且身份过期，返回这个状态码

这样设置后，您还需要在前端代码中做这些事情：

1. 给你的所有AJAX请求带上以`'x-client-ajax'`为key，value不为空的请求头，如: `'x-client-ajax': 1`。
2. 当AJAX响应收到约定的状态码，表示用户身份已过期，此时调用`window.location.reload()`或是别的事情来让你的用户重新获取身份。

#### options.debug {Boolean} (Deprecated)
原本这个选项是用于控制是否输出所有log，但是因为CAS协议的复杂性，我们建议哪怕是生产环境也要输出所有日志，故废弃了该字段。

另外，生产环境下，我们建议使用自定义的logger，对于输入日志的级别您可以自行在logger中控制。

#### options.redirect(req, res) {Function} (Optional, default: null)
默认情况下，用户登录后，或是登录失败后，都会重定向到最后一次访问的路径，设置这个选项可以改变这个行为。

当您需要自行处理重定向逻辑时，配置redirect函数, 并且返回您想要重定向的路径字符串, 如: '/somewhere'.

大部分场景您都不需要配置该项，除了一些比较特殊的场景，比如说某些页面当用户注销后您不希望用户直接跳到登陆页，而是可以继续浏览，具体的操作请看下面的例子：

```javascript

var options = {
  redirect: function(req, res) {
    // 在redirect中， 根据是否有特殊cookie来决定是否跳走
    if (req.cookies.logoutFrom) {
      // 返回您想要重定向的路径
      return url.parse(req.cookies.logoutFrom).pathname;
    }
  }
};

var casClient = new CasClient(options)

app.get('/logout', function(req, res) {
  var fromWhere = req.get('Referer');
  var fromWhereUri = url.parse(fromWhere);

  // 根据来源判断是否是你不希望用户注销后登陆的页面，如果是的话，设置设置cookie
  if (fromWhereUri.pathname.match(/the page you dont want user to login after logout/)) {
    res.cookie('logoutFrom', fromWhereUri.pathname);
  }
  casClient.logout()(req, res);
});

````

#### options.cache {Object} (Optional) `Since v1.1.0-beta`
(仅在代理模型下有用)

当你的后端支持PT缓存并且开始缓存后，您可以设置`options.cache.enable`为true来启用PT缓存，在有效期内，对于一个targetService都会使用缓存的PT。

注意过期时间的设置，推荐client侧的过期时间略短于后端，万一client侧的PT未过期，后端server的PT已过期，那么使用该pt请求将会收到响应码401，此时您需要手动调用`req.getProxyTicket(targetService, {renew: true}, callback)`来重新获取一个新的PT。

更多信息请查看`req.getProxyTicket`的介绍。

（注意：启用此选项前您必须确认您的后代服务是否已启动缓存，否则单在client侧缓存不会起任何作用，因为默认PT是用一次就过期的。）

#### options.cache.enable {Boolean} (Optional, 默认为false)
设置为true来开始Client侧的PT缓存

#### options.cache.ttl {Number} (Optional, 默认为 300000， 单位毫秒)
过期时间，单位毫秒

#### options.cache.filter {Array} (Optinal, default: [])
某些场景下，特别是当您需要与多个后端服务交互数据时，可能并不是每个服务都开启了缓存，此时可以通过此配置设置规律规则。

任何一条规则匹配都将直接不使用缓存。规则匹配规则同`options.ignore`。

#### options.restletIntegration {Object} (Optional, defualt: {})
配置你的restlet integration。

当使用restlet integraion时, 用户不需要登录, 并且能够通过访问一个CAS Server的特殊接口获取一个特殊的PGT, 用这个PGT可以向CAS Server换取PT, 并与特殊的一个后端服务交互数据.

options.restletIntegration是一个对象, 其中key代表的特定的restlet integration的规则名, value是一个对象, 需要包含两个属性: trigger {Function}, params {Object},

其中trigger决定了是否使用该条规则的参数来获取PGT, params决定了要向接口传递什么参数. 

对于使用restlet integration的PGT获取PT的过程用户不需要关注, 仍与调普通后端接口一样先用req.getProxyTicket获取pt, 再发送请求即可.

对于我们自己的使用场景, 是用于设置DEMO产品. 当用户访问特定DEMO产品时, trigger中判断访问的路径与产品Id, 匹配时trigger返回true, 然后在调用req.getProxyTicket时会自动去获取PGT, 然后自动换PT, 与普通接口一样使用.

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
casClient.core()中间件的钩子函数, 目前支持两个钩子函数, 触发时机分别是请求流进入cas中间件与结束中间件, 您可以在这其中添加监控、耗时等业务逻辑. 钩子函数将会被如同中间件一样调用.

#### options.hooks.before {Function}
当请求流进入casClient.core()中间件时被调用, 他将会被如同中间件一样被调用: `options.hooks.before(req, res, next)`.(不要忘记最后调用`next()`)

#### options.hooks.after {Function}
当casClient.core()中间件的所有业务逻辑执行结束后被调用, 它的调用方法同上, 再次提醒, 不要忘记最后调用`next()`.

#### options.logger {Function} (Optional)
一个自定义logger的工厂函数。接受两个参数 `req`与`type`，`req`是Express的Response对象，`type`是一个字符串，为这三个之一： 'log', 'error', 'warn'。

该函数根据type的不同返回对应的用于打印日志的函数。 比如默认情况下，使用的系统的console对象下的函数：`options.logger = (req, type) => return console[type].bind(console[type])`。

在生产环境下，您可能需要自定义输出日志的格式、内容、输出方式，可能会用到log4js、winston等组件， 这些场景下， 您可能需要设置`options.logger`配置。

在我们自己项目的使用场景下，我们甚至需要给每一条日志打上用户与ip的信息，这也是为什么会将Request对象传给工厂函数。

下面是一个我们实际使用时的例子：

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

### 方法

#### casClient.core()

返回casClient的核心中间件，处理了几乎所有CAS协议相关的业务逻辑。

使用： `app.use(casClient.core())`。

#### casClient.logout()
返回处理注销逻辑的中间件，注销session、然后重定向到CAS Server的注销页面。

您可以直接使用该中间件：`app.get('/logout', casClient.logout())`，

也可以在处理您自己的业务逻辑后手动调用该中间件：

```javascript
  app.get('/logout', function(req, res) {
    // Do your logic here, then call the logout middle
    casClient.logout()(req, res)
  });

```

#### req.getProxyTicket(targetService, [proxyOptions], callback)
在使用`casClient.core()`中间件后，您可以在req对象上获取一个`getProxyTicket`函数。

当您使用代理模型时，您可以通过该方法来获取一个用于与后端服务交互数据的PT，当非代理模型下，调用该函数会直接执行回调，参数为空。

`targetService` {String} 是您需要访问的后端服务的认证ticket的完整路径。您需要确认您的后端服务使用的是什么cas client，配置如何，如使用Java的shiro-cas库，那么默认路径为: http://server.com/shiro-cas，如果也是使用NodeJS的connect-cas2，那么路径将为: http://nodeserver.com/cas/validate

`proxyOptions`  {Object}        (Optional) 获取PT的选项

`proxyOptions.disableCache`     {Boolean} 如果设置为true，将会跳过缓存直接获取一个新的PT

`proxyOptions.renew`            {Boolean} 如果设置为true，将会跳过缓存直接获取一个新的PT，随后将新的PT设置进缓存，覆盖旧的缓存PT

Example:
```javascript
   app.get('/api', function(req, res) {
     var service = 'http://your-service.com';
     req.getProxyTicket(service + '/cas', function ptCallback(err, pt) {
       if (err) return res.status(401).send('Error when requesting PT, Authentication failed!');

       request.get(service + '/api/someapi?ticket=' + 'pt', function (err, response) {
          if (err) return res.sendStatus(500);

          // 如果在client pt未过期，而server上pt已过期，此时会返回401，手段设置renew重新获取
          if (response.status == 401) {
            // 注意跳出逻辑，避免由于身份问题的401导致死循环
            return req.getProxyTicket(service + '/cas', {renew: true}, ptCallback);
          }

          res.send(response);
       });
     });
   });
```

## CHANGE LOG
[CHANGE LOG](https://github.com/TencentWSRD/connect-cas2/blob/master/CHANGELOG.md)

## CONTRIBUTION
新的代码变更请确保能够通过`npm run test`并且覆盖率达到90%+。

测试使用的CAS Server是mock的, 如有新特性需要测试请先修改 `/test/lib/casServer.js`, 然后在`/test/casServer.test.js`中为新特性编写测试代码, 并且确认通过后再基于mock的Cas Server进行开发测试。

## More

当前该项目已使用在我们的生产环境下，如果您在使用中发现任何问题，请提ISSUE，谢谢！

## License

  MIT
