var _ = require('lodash');
var utils = require('./utils');
var queryString = require('query-string');

module.exports = function(req, res, next, options) {
  var debug = !!options.debug;

  if (req.session && req.session.st) {
    if ((options.paths.proxyCallback && req.session.pgt) || !options.paths.proxyCallback) {
      return next();
    } else {
      if (options.paths.proxyCallback && !req.session.pgt) {
        if (debug) {
          console.log('Using proxy-mode CAS, but pgtId is not found in session.');
        }
      }
    }
  } else {
    if (debug) {
      console.log('Can not find st in session', req.session);
    }
  }

  // 先将之前原始路径存在session
  req.session.lastUrl = utils.getOrigin(req, options);

  req.session.save();

  var params = {};

  params.service = utils.getPath('service', options);

  if (options.renew === true) {
    params.renew = true;
  } else if (options.gateway === true) {
    params.gateway = true;
  }

  if (options.fromAjax && options.fromAjax.header && req.get(options.fromAjax.header)) {
    if (debug) {
      console.log('Need to redirect, but matched AJAX request, send ' + options.fromAjax.status);
    }
    res.status(options.fromAjax.status).send({ message: 'Login status expired, need refresh path' });
  } else {
    var loginPath = utils.getPath('login', options);
    if (debug) {
      console.log('redirect to login page ', loginPath);
    }
    res.redirect(302, loginPath);
  }
};
