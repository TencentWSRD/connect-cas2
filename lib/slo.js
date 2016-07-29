var utils = require('./utils');

/**
 * Handle single-signed off request from CAS server
 *
 * @param req
 * @param res
 * @param next
 * @param options
 */
module.exports = function(req, res, next, options) {
  var logger = utils.getLogger(req, options);
  
  /* istanbul ignore if */
  if (!req.sessionStore) {
    var error = new Error('req.sessionStore is not defined, maybe you havn\'t initialize cookie session.');
    logger.error(error.stack);
    return res.status(500).send({
      message: error.message
    });
  }

  logger.info('Receive slo request... Trying to logout.');

  var body = '';
  req.on('data', function(chunk) {
    body += chunk;
  });
  req.on('end', function() {
    if (!/<samlp:SessionIndex>(.*)<\/samlp:SessionIndex>/.exec(body)) {
      logger.info('Slo request receive, but body content is not valid');

      // 响应已经end了, 没next了
      return res.sendStatus(202);
    }
    var st = RegExp.$1;

    req.sessionStore.get(st, function(err, result) {
      /* istanbul ignore if */
      if (err) {
        logger.error('Trying to ssoff, but get st from session failed!');
        logger.error(err);
        return res.sendStatus(202);
      }

      /* istanbul ignore else */
      if (result && result.sid) {
        logger.info('Find sid by st succeed, trying to destroy it.', 'st', st, 'sessionId', result.sid);
        req.sessionStore.destroy(result.sid, function(err) {
          /* istanbul ignore if */
          if (err) {
            logger.error('Error when destroy session for id: ', result.sid);
            logger.error(err);
            return res.sendStatus(202);
          }

          finalHandler(req, res, st, true);
        });
      } else {
        logger.info('Can not find sid by st', result);
        finalHandler(req, res, st, false);
      }
    });
  });

  function finalHandler(req, res, st, isSucceed) {
    req.sessionStore.destroy(st, function(err) {
      /* istanbul ignore if */
      if (err) {
        logger.error('Error when destroy st in session store. ', st);
        logger.error(err);
      }

      res.sendStatus(isSucceed ? 200 : 202);
    });
  }
};
