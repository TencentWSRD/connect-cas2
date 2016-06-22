var _ = require('lodash');

/**
 * Receive callback from CAS server, receiving PGTIOU and PGTID from this request, store them somewhere in sessionStore.
 *
 * @param req
 * @param res
 * @param next
 * @param options
 * @param logger
 */
module.exports = function proxyCallback(req, res, next, options, logger) {
  logger.info(req, 'Receiving pgtIou from CAS server...');
  logger.info(req, 'req.path', req.path);
  logger.info(req, 'req.query', req.query);

  if (!req.query || !req.query.pgtIou || !req.query.pgtId) {
    logger.warn(req, 'Receiving pgtIou from CAS server, but with unexpected pgtIou: ' + req.query.pgtIou + ' or pgtId: ' + req.query.pgtId);
    return res.sendStatus(200);
  }

  // TODO: PGTIOU -> PGTID should expire quick
  return req.sessionStore.set(req.query.pgtIou, _.extend(req.session, {
    pgtId: req.query.pgtId
  }), function(err) {
    if (err) {
      logger.error(req, 'Error happened when trying to store pgtIou in sessionStore.');
      logger.error(req, err);

      return res.status(500).send({
        message: 'Error happened when trying to store pgtIou in sessionStore.',
        error: err
      });
    }

    logger.info(req, 'Receive and store pgtIou together with pgtId succeed!');

    res.sendStatus(200);
  });
};