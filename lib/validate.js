var url = require('url');
var fetch = require('node-fetch');
var queryString = require('query-string');
var xml2js = require('xml2js').parseString;
var stripPrefix = require('xml2js/lib/processors').stripPrefix;
var http = require('http');
var utils = require('./utils');

/**
 * If options.proxyCallback is an absolute path, return itself, otherwise return `{options.servicePrefix} + options.paths.proxyCallback`
 *
 * @param options
 * @returns {string|string}
 */
function getPgtUrl(options) {
  var proxyCallbackUri = url.parse(options.paths.proxyCallback);

  return (proxyCallbackUri.protocol && proxyCallbackUri.host) ? options.paths.proxyCallback : (options.servicePrefix + options.paths.proxyCallback);
}

/**
 * Validate ticket from CAS server
 *
 * @param req
 * @param options
 * @param callback
 */
function validateTicket(req, options, callback) {
  var query = {
    service: options.servicePrefix + options.paths.validate,
    ticket: req.query.ticket
  };

  if (options.paths.proxyCallback) query.pgtUrl = getPgtUrl(options);

  var casServerValidPath = options.serverPath + options.paths.serviceValidate + '?' + queryString.stringify(query);

  if (options.debug) {
    console.log('Sending request to: "' + casServerValidPath + '" to validate ticket.');
  }

  utils.getRequest(casServerValidPath, function(err, response) {
    if (err) {
      return callback(err);
    }

    callback(null, response);
  });
}

/**
 * Parse response XML from CAS server and do the rest of validation.
 *
 * @param req
 * @param res
 * @param casBody
 * @param options
 * @param next
 */
function validateCasResponse(req, res, casBody, options, next) {
  var debug = !!options.debug;
  var ticket = req.query.ticket;

  xml2js(casBody, {
    explicitRoot: false,
    tagNameProcessors: [stripPrefix]
  }, function(err, serviceResponse) {
    if (err) {
      console.error('Failed to parse CAS server response when trying to validate ticket.');
      console.error(err);
      return res.status(500).send({
        message: 'Failed to parse CAS server response when trying to validate ticket.',
        error: err
      });
    }

    var success = serviceResponse && serviceResponse.authenticationSuccess && serviceResponse.authenticationSuccess[0];
    var user = success && success.user && success.user[0];
    var pgtIou = success && success.proxyGrantingTicket && success.proxyGrantingTicket[0];

    if (!serviceResponse) {
      console.error('Invalid CAS server response.');
      return res.status(500).send({
        message: 'Invalid CAS server response, serviceResponse empty.'
      });
    }

    var lastUrl = utils.getLastUrl(req, options);

    if (!success) {
      console.log('Receive response from CAS when validating ticket, but the validation is failed. Redirect to the last request url: ' + lastUrl);
      if (typeof options.redirect === 'function' && options.redirect(req, res, next)) {
        return;
      }

      return res.redirect(302, lastUrl);
    }

    req.session.st = ticket;

    if (options.ssoff) {
      req.sessionStore.set(ticket, { sid: req.session.id }, function(err) {
        if (err) {
          console.log('Trying to store ticket in sessionStore for ssoff failed!');
          console.error(err);
        }
      });
    }

    req.session.cas = {};
    for (var casProperty in success) {
      if (casProperty != 'proxyGrantingTicket') {
        req.session.cas[casProperty] = success[casProperty][0];
      }
    }

    if (!pgtIou) {
      if (options.paths.proxyCallback) {
        console.log('pgtUrl is specific, but havn\'t find pgtIou from CAS validation response!');
        return res.status(401).send({
          message: 'pgtUrl is specific, but havn\'t find pgtIou from CAS validation response!'
        });
      } else {
        if (debug) {
          console.log('None-proxy mode, validate ticket succeed, redirecting to lastUrl: ' + lastUrl);
        }
        req.session.save(function(err) {
          if (err) {
            console.log('Trying to save session failed!');
            console.error(err);
            return res.status(500).send({
              message: 'Trying to save session failed!',
              error: err
            });
          }
          if (typeof options.redirect === 'function' && options.redirect(req, res)) {
            return;
          }

          return res.redirect(302, lastUrl);
        });
      }

      return;
    }

    retrievePGTFromPGTIOU(req, res, pgtIou, options);
  });
}

function retrievePGTFromPGTIOU(req, res, pgtIou, options) {
  var debug = !!options.debug;

  if (debug) {
    console.log('Trying to retrieve pgtId from pgtIou.');
  }

  req.sessionStore.get(pgtIou, function(err, session) {
    if (err) {
      console.log('Get pgtId from sessionStore failed!');
      console.error(err);
      req.sessionStore.destroy(pgtIou);
      return res.status(500).send({
        message: 'Get pgtId from sessionStore failed!',
        error: err
      });
    }

    if (session && session.pgtId) {
      var lastUrl = utils.getLastUrl(req, options);
      if (debug) {
        console.log('CAS proxy mode login and validation succeed, pgtId finded. Redirecting to lastUrl: ' + lastUrl);
      }

      req.session.pgt = session.pgtId;

      req.session.save(function(err) {
        if (err) {
          console.error('Trying to save session failed!');
          console.error(err);
          return res.status(500).send({
            message: 'Trying to save session failed!',
            error: err
          });
        }

        // 释放
        req.sessionStore.destroy(pgtIou);

        if (typeof options.redirect === 'function' && options.redirect(req, res)) {
          return;
        }

        return res.redirect(302, lastUrl);
      });
    } else {
      console.error('CAS proxy mode login and validation succeed, but can\' find pgtId from pgtIou: `' + pgtIou + '`, maybe something wrong with sessionStroe!');
      res.status(401).send({
        message: 'CAS proxy mode login and validation succeed, but can\' find pgtId from pgtIou: `' + pgtIou + '`, maybe something wrong with sessionStroe!'
      });
    }
  });
}


/**
 * Validate a ticket from CAS server
 *
 * @param req
 * @param res
 * @param next
 */
function validate(req, res, next, options) {
  // check ticket first
  var ticket = req.query && req.query.ticket || null;
  var session = req.session;

  if (ticket) {
    if (session.st && session.st === ticket) return next();

    validateTicket(req, options, function(err, response) {
      if (response.status === 200) {
        validateCasResponse(req, res, response.body, options, next);
      } else {
        console.log('Receive response from cas when validating ticket, but request failed with status code: ' + response.status + '!');
        res.status(401).send({
          message: 'Receive response from cas when validating ticket, but request failed with status code: ' + response.status + '.'
        });
      }
    });
  }
}

module.exports = validate;
