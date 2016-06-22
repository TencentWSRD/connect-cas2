var _ = require('lodash');
var utils = require('./utils');
var queryString = require('query-string');

/**
 *
 * @param req
 * @param res
 * @param next
 * @param options
 * @param logger
 * @returns {*}
 */
module.exports = function(req, res, next, options, logger) {
  logger.info(req, 'Doing authenticating...');
  if (req.session && req.session.st) {
    logger.info(req, 'Find st in session');
    if ((options.paths.proxyCallback && req.session.pgt) || !options.paths.proxyCallback) {
      if (!options.paths.proxyCallback) logger.info(req, 'Non-proxy mode, go next()');
      if (options.paths.proxyCallback && req.session.pgt) logger.info(req, 'Proxy-mode, pgt is valid.');
      return next();
    } else {
      if (options.paths.proxyCallback && !req.session.pgt) {
        logger.error(req, 'Using proxy-mode CAS, but pgtId is not found in session.');
      }
    }
  } else {
    logger.info(req, 'Can not find st in session', req.session);
  }

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
    logger.info(req, 'Need to redirect, but matched AJAX request, send ' + options.fromAjax.status);
    res.status(options.fromAjax.status).send({ message: 'Login status expired, need refresh path' });
  } else {
    var loginPath = utils.getPath('login', options);
    logger.info(req, 'redirect to login page ', loginPath);
    res.redirect(302, loginPath);
  }
};
