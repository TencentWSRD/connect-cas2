1.1.24
=================
* Change the behavior of `options.redirect(req, res)`, return you must return the pathname where you want to redirect other than return a Boolean and handle response in the function in the past.
* Add `options.hooks`
* Fix that only GET request will go into the authenticate middleware issue.

1.1.21
=================
* Change options.ssoff to options.slo

1.1.21-beta
=================
* Add test code.

1.1.20-beta
=================
* Bug fix for utils.sendRequest.

1.1.19-beta
=================
* When restlet pgt is using, don't set it on session.

1.1.16-beta
=================
* Add clear restlet cache feature.

1.1.15-beta
=================
* Add `restlet` feature.

1.1.13-beta
=================
* Support redis/memcache session, add cookie when set sessionStore.

1.1.11-beta
=================
* Support absolute url for proxyCallback.

1.1.10-beta
=================
* Improve custom logger.

1.1.6-beta
=================
* Add custom logger support.

1.1.4-beta
=================
* Add https support.

1.1.2-beta
=================
* Add retry when cached PT expired, add `renew` option support.

1.1.1-beta
=================
* Fix req.pathname is undefined, change to req.path.

1.1.0-beta
=================
* Add `cache proxy ticket` feature.

1.0.0-beta
=================
* Restructured from [nodejs-cas](https://npmjs.com/package/nodejs-cas).
