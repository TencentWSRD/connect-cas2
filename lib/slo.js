/**
 * Handle single-signed off request from CAS server
 *
 * @param req
 * @param res
 * @param next
 * @param options
 */
module.exports = function(req, res, next, options, logger) {
  if (!req.sessionStore) throw new Error('no session store configured');

  var body = '';
  req.on('data', function(chunk) {
    body += chunk;
  });
  req.on('end', function() {
    if (!/<samlp:SessionIndex>(.*)<\/samlp:SessionIndex>/.exec(body)) {
      next();
      return;
    }
    var st = RegExp.$1;

    req.sessionStore.get(st, function(err, result) {
      if (err) {
        logger.error('Trying to ssoff, but get st from session failed!');
        logger.error(err);
        return;
      }

      if (result && result.sid) req.sessionStore.destroy(result.sid);
      req.sessionStore.destroy(st);
    });
    res.send(200);
  });
};