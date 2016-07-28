var url = require('url');
var queryString = require('query-string');
var xml2js = require('xml2js').parseString;
var stripPrefix = require('xml2js/lib/processors').stripPrefix;
var http = require('http');
var utils = require('./utils');

/**
 * Validate a ticket from CAS server
 *
 * @param req
 * @param res
 * @param next
 * @param options
 * @param logger
 */
function validate(req, res, next, options, logger) {
  // check ticket first`
  var ticket = req.query && req.query.ticket || null;
  var session = req.session;
  var lastUrl = utils.getLastUrl(req, options, logger);

  logger.info('Start validating ticket...');

  if (ticket) {
    logger.info('Find ticket in query', ticket);
    if (session && session.cas && session.cas.st && session.cas.st === ticket) {
      logger.info('Ticket in query is equal to the one in session, go last url: ' + lastUrl);
      return res.redirect(302, lastUrl);
    }

    validateTicket(req, options, logger, function(err, response) {
      /* istanbul ignore if */
      if (err) {
        return res.status(500).send({
          message: 'Receive response from cas when validating ticket, but request failed because an error happened.',
          error: err.message
        });
      }

      logger.info('Receive from CAS server, status: ' + response.status);
      if (response.status === 200) {

        parseCasResponse(response.body, logger, function(err, info) {
          if (err) {
            var resBody = {
              error: err
            };
            if (info && info.message) resBody.message = info.message;
            return res.status(500).send(resBody);
          }

          if (!info || (info && !info.user)) {
            return res.status(401).send({
              message: 'Receive response from CAS when validating ticket, but the validation is failed.'
            });
          }

          var pgtIou = info.proxyGrantingTicket;

          delete info.proxyGrantingTicket;

          req.session.cas = info;

          var ticket = req.query.ticket;

          req.session.cas.st = ticket;

          if (options.slo) {
            req.sessionStore.set(ticket, { sid: req.session.id, cookie: req.session.cookie }, function(err) {
              /* istanbul ignore if */
              if (err) {
                logger.info('Trying to store ticket in sessionStore for ssoff failed!');
                logger.error(err);
              }
            });
          }

          if (!pgtIou) {
            if (options.paths.proxyCallback) {
              logger.error('pgtUrl is specific, but havn\'t find pgtIou from CAS validation response! Response status 401.');
              return res.status(401).send({
                message: 'pgtUrl is specific, but havn\'t find pgtIou from CAS validation response!'
              });
            } else {
              logger.info('None-proxy mode, validate ticket succeed, redirecting to lastUrl: ' + lastUrl);
              req.session.save(function(err) {
                /* istanbul ignore if */
                if (err) {
                  logger.error('Trying to save session failed!');
                  logger.error(err);
                  return res.status(500).send({
                    message: 'Trying to save session failed!',
                    error: err
                  });
                }
                if (typeof options.redirect === 'function' && options.redirect(req, res)) {
                  logger.info('Specific options.redirect matched, redirect to customize location');
                  return;
                }

                return res.redirect(302, lastUrl);
              });
            }

            return;
          }

          retrievePGTFromPGTIOU(req, res, pgtIou, options, logger);
        });
      }
      else {
        logger.error('Receive response from cas when validating ticket, but request failed with status code: ' + response.status + '!');
        res.status(401).send({
          message: 'Receive response from cas when validating ticket, but request failed with status code: ' + response.status + '.'
        });
      }
    });
  } else {
    lastUrl = utils.getLastUrl(req, options, logger);
    logger.info('Can\' find ticket in query, redirect to last url: ' + lastUrl);
    res.redirect(302, lastUrl);
  }
}

module.exports = validate;

/**
 * Validate ticket from CAS server
 *
 * @param req
 * @param options
 * @param logger = {logError, logInfo}
 * @param callback
 */
function validateTicket(req, options, logger, callback) {
  var query = {
    service: utils.getPath('service', options),
    ticket: req.query.ticket
  };

  if (options.paths.proxyCallback) query.pgtUrl = utils.getPath('pgtUrl', options);

  var casServerValidPath = utils.getPath('serviceValidate', options) + '?' + queryString.stringify(query);

  logger.info('Sending request to: "' + casServerValidPath + '" to validate ticket.');

  utils.getRequest(casServerValidPath, function(err, response) {
    /* istanbul ignore if */
    if (err) {
      logger.error('Error when sending request to CAS server, error: ', err.toString());
      logger.error(err);
      return callback(err);
    }

    callback(null, response);
  });
}

/**
 * 从cas的响应的xml中解析出数据
 *
 * @param casBody
 * @param logger
 * @param callback
 */
function parseCasResponse(casBody, logger, callback) {
  xml2js(casBody, {
    explicitRoot: false,
    tagNameProcessors: [stripPrefix]
  }, function(err, serviceResponse) {
    /* istanbul ignore if */
    if (err) {
      logger.error('Failed to parse CAS server response when trying to validate ticket.');
      logger.error(err);
      return callback(err, {
        message: 'Failed to parse CAS server response when trying to validate ticket.'
      });
    }

    if (!serviceResponse) {
      logger.error('Invalid CAS server response.');
      return callback(new Error('Invalid CAS server response, serviceResponse empty.'), {
        message: 'Invalid CAS server response, serviceResponse empty.'
      });
    }

    var success = serviceResponse.authenticationSuccess && serviceResponse.authenticationSuccess[0];

    if (!success) {
      logger.error('Receive response from CAS when validating ticket, but the validation is failed.');
      logger.error('Cas response:', serviceResponse);
      return callback(null, {});
    }

    var casResponse = {};
    for (var casProperty in success) {
      casResponse[casProperty] = success[casProperty][0];
    }

    return callback(null, casResponse);
  })
}

/**
 * Find PGT by PGTIOU
 *
 * @param req
 * @param res
 * @param pgtIou
 * @param options
 * @param logger
 */
function retrievePGTFromPGTIOU(req, res, pgtIou, options, logger) {
  logger.info('Trying to retrieve pgtId from pgtIou...');

  req.sessionStore.get(pgtIou, function(err, session) {
    /* istanbul ignore if */
    if (err) {
      logger.error('Get pgtId from sessionStore failed!');
      logger.error(err);
      req.sessionStore.destroy(pgtIou);
      return res.status(500).send({
        message: 'Get pgtId from sessionStore failed!',
        error: err
      });
    }

    if (session && session.pgtId) {
      var lastUrl = utils.getLastUrl(req, options, logger);

      if (!req.session || req.session && !req.session.cas) {
        logger.error('Here session.cas should not be empty!', req.session);
        req.session.cas = {};
      }

      req.session.cas.pgt = session.pgtId;

      req.session.save(function(err) {
        /* istanbul ignore if */
        if (err) {
          logger.error('Trying to save session failed!');
          logger.error(err);
          return res.status(500).send({
            message: 'Trying to save session failed!',
            error: err
          });
        }

        // 释放
        req.sessionStore.destroy(pgtIou);

        /* istanbul ignore if */ // 测一次就够了
        if (typeof options.redirect === 'function' && options.redirect(req, res)) {
          logger.info('CAS proxy mode login and validation succeed, pgtId finded. Customize redirect matched, redirect to comstomize location.');
          return;
        }

        logger.info('CAS proxy mode login and validation succeed, pgtId finded. Redirecting to lastUrl: ' + lastUrl);
        return res.redirect(302, lastUrl);
      });
    } else {
      logger.error('CAS proxy mode login and validation succeed, but can\' find pgtId from pgtIou: `' + pgtIou + '`, maybe something wrong with sessionStroe!');
      res.status(401).send({
        message: 'CAS proxy mode login and validation succeed, but can\' find pgtId from pgtIou: `' + pgtIou + '`, maybe something wrong with sessionStroe!'
      });
    }
  });
}


// /**
//  * Parse response XML from CAS server and do the rest of validation.
//  *
//  * @param req
//  * @param res
//  * @param casBody
//  * @param options
//  * @param next
//  * @param logger = {logError, logInfo}
//  */
// function validateCasResponse(req, res, casBody, options, next, logger) {
//   var ticket = req.query.ticket;
//
//   xml2js(casBody, {
//     explicitRoot: false,
//     tagNameProcessors: [stripPrefix]
//   }, function(err, serviceResponse) {
//     if (err) {
//       logger.error('Failed to parse CAS server response when trying to validate ticket.');
//       logger.error(err);
//       return res.status(500).send({
//         message: 'Failed to parse CAS server response when trying to validate ticket.',
//         error: err
//       });
//     }
//
//     var success = serviceResponse && serviceResponse.authenticationSuccess && serviceResponse.authenticationSuccess[0];
//     var user = success && success.user && success.user[0];
//     var pgtIou = success && success.proxyGrantingTicket && success.proxyGrantingTicket[0];
//
//     if (!serviceResponse) {
//       logger.error('Invalid CAS server response.');
//       return res.status(500).send({
//         message: 'Invalid CAS server response, serviceResponse empty.'
//       });
//     }
//
//     var lastUrl = utils.getLastUrl(req, options);
//
//     if (!success) {
//       logger.error('Receive response from CAS when validating ticket, but the validation is failed.');
//       logger.error('Cas response:', serviceResponse);
//       return res.status(401).send({
//         message: 'Receive response from CAS when validating ticket, but the validation is failed.'
//       });
//     }
//
//     req.session.st = ticket;
//
//     if (options.slo) {
//       req.sessionStore.set(ticket, { sid: req.session.id, cookie: req.session.cookie }, function(err) {
//         if (err) {
//           logger.info('Trying to store ticket in sessionStore for ssoff failed!');
//           logger.error(err);
//         }
//       });
//     }
//
//     req.session.cas = {};
//     for (var casProperty in success) {
//       if (casProperty != 'proxyGrantingTicket') {
//         req.session.cas[casProperty] = success[casProperty][0];
//       }
//     }
//
//     if (!pgtIou) {
//       if (options.paths.proxyCallback) {
//         logger.error('pgtUrl is specific, but havn\'t find pgtIou from CAS validation response! Response status 401.');
//         return res.status(401).send({
//           message: 'pgtUrl is specific, but havn\'t find pgtIou from CAS validation response!'
//         });
//       } else {
//         logger.info('None-proxy mode, validate ticket succeed, redirecting to lastUrl: ' + lastUrl);
//         req.session.save(function(err) {
//           if (err) {
//             logger.error('Trying to save session failed!');
//             logger.error(err);
//             return res.status(500).send({
//               message: 'Trying to save session failed!',
//               error: err
//             });
//           }
//           if (typeof options.redirect === 'function' && options.redirect(req, res)) {
//             logger.info('Specific options.redirect matched, redirect to customize location');
//             return;
//           }
//
//           return res.redirect(302, lastUrl);
//         });
//       }
//
//       return;
//     }
//
//     retrievePGTFromPGTIOU(req, res, pgtIou, options, logger);
//   });
// }