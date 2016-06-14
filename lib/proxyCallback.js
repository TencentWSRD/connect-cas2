var _ = require('lodash');

/**
 * Receive callback from CAS server, receiving PGTIOU and PGTID from this request, store them somewhere in sessionStore.
 *
 * @param req
 * @param res
 * @param next
 */
module.exports = function proxyCallback(req, res, next, options) {
  var debug = !!options.debug;

  if (debug) {
    console.log('Receiving pgtIou from CAS server.');
    console.log('req.path', req.path);
    console.log('req.query', req.query);
  }

  if (!req.query || !req.query.pgtIou || !req.query.pgtId) {
    if (debug) {
      console.log('Receiving pgtIou from CAS server, but with unexpected pgtIou: ' + req.query.pgtIou + ' or pgtId: ' + req.query.pgtId);
    }
    return res.sendStatus(200);
  }

  // TODO: PGTIOU -> PGTID should expire quick
  return req.sessionStore.set(req.query.pgtIou, _.extend(req.session, {
    pgtId: req.query.pgtId
  }), function(err) {
    if (err) {
      console.log('Error happened when trying to store pgtIou in sessionStore.');
      console.error(err);

      return res.status(500).send({
        message: 'Error happened when trying to store pgtIou in sessionStore.',
        error: err
      });
    }

    if (debug) {
      console.log('Receive and store pgtIou together with pgtId succeed!');
    }

    res.sendStatus(200);
  });
};