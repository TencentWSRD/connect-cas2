var utils = require('./utils');

/**
 *
 * @param req
 * @param callback
 * @param options
 * @returns {*}
 */
module.exports = function(req, callback, options) {
  var logger = utils.getLogger(req, options);
  logger.info('Doing authenticating...');
  if (req.session && req.session.cas && req.session.cas.st) {
    logger.info('Find pt in session');
    if ((options.paths.proxyCallback && req.session.cas.pgt) || !options.paths.proxyCallback) {
      if (!options.paths.proxyCallback) logger.info('Non-proxy mode, go next()');
      if (options.paths.proxyCallback && req.session.cas.pgt) logger.info('Proxy-mode, pgt is valid.');
      return callback(function(req, res, next) {
        next();
      });
    } else {
      if (options.paths.proxyCallback && !req.session.cas.pgt) {
        logger.error('Using proxy-mode CAS, but pgtId is not found in session.');
      }
    }
  } else {
    logger.info('Can not find st in session', req.session);
  }

  req.session.lastUrl = utils.getOrigin(req, options);

  req.session.save();

  var params = {};

  params.service = utils.getPath('service', options);

  // TODO: renew & gateway is not implement yet
  // if (options.renew === true) {
  //   params.renew = true;
  // } else if (options.gateway === true) {
  //   params.gateway = true;
  // }

  if (options.fromAjax && options.fromAjax.header && req.get(options.fromAjax.header)) {
    logger.info('Need to redirect, but matched AJAX request, send ' + options.fromAjax.status);
    callback(function(req, res, next) {
      res.status(options.fromAjax.status).send({ message: 'Login status expired, need refresh path' });
    });
  } else {
    var loginPath;
    if (options.paths.login && typeof options.paths.login === 'function') {
      logger.info('use function manner for custom config');
      loginPath = options.paths.login(req, logger);
    } else {
      logger.info('use default manner');
      loginPath = utils.getPath('login', options);
    }
    loginPath += '&sn=' + req.sn;
    logger.info('redirect to login page ', loginPath);
    callback(function(req, res, next) {
      res.redirect(302, loginPath);
    });
  }
};
