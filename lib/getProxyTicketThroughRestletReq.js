var globalPGTStore = require('./globalStoreCache');
var getProxyTickets = require('./getProxyTicket');
var utils = require('./utils');
var url = require('url');

/**
 *
 * @param req
 * @param targetService
 * @param {String} restletIntegrateRuleKey
 * @param restletIntegrateOption
 * @param logger
 * @param callback
 * @param {Boolean} doNotRetry
 */
function getProxyTicketThroughRestletReq(req, targetService, restletIntegrateRuleKey, restletIntegrateOption, logger, callback, doNotRetry) {
  var options = this.options;
  var that = this;

  var pgt = globalPGTStore.get(restletIntegrateRuleKey);

  if (pgt) {
    if (!req.session) req.session = {};
    req.session.pgt = pgt;
    logger.info('Find PGT for ' + restletIntegrateRuleKey + ' succeed, PGT: ', pgt);
    return getProxyTickets.call(that, req, targetService, callback, logger, function retryHandler(err) {
      if (doNotRetry === true) {
        logger.info('Use cached pgt request failed, but doNotRetry set to true, use original callback with err', err);
        return callback(err);
      }
      logger.info('Use cached pgt request failed, maybe expired, retry once.');

      globalPGTStore.remove(restletIntegrateRuleKey);

      getProxyTicketThroughRestletReq.call(that, req, targetService, restletIntegrateRuleKey, restletIntegrateOption, logger, callback);

    });
  } else {
    logger.info('Send request to ' + utils.getPath('restletIntegration', options) + ' to get PGT.');
    utils.postRequest(utils.getPath('restletIntegration', options), restletIntegrateOption.params, function(err, response) {
      if (err) {
        logger.error('Request to get PGT failed.');
        logger.error(err.message);
        return callback(err);
      }

      if (!response) {
        logger.error('Response empty response from restletIntegration on CAS server');
        return callback(new Error('Response empty response from restletIntegration on CAS server'));
      }

      if (response.status === 200 || response.status === 201) {
        var result = response.body.match(/action="([\s\S]*?)"/);
        if (result) {
          result = result[1];

          var uri = url.parse(result);
          var pathname = uri.pathname;

          var pgt = pathname.substr(pathname.lastIndexOf('/') + 1);

          globalPGTStore.set(restletIntegrateRuleKey, pgt);
          req.session.pgt = pgt;
          return getProxyTickets.call(that, req, targetService, callback, logger);
        } else {
          callback(new Error('Not a valid response from CAS Server!'));
        }
      } else {
        logger.error('Request for TGT from restletIntegration failed!');
        logger.info(response);
        return callback(new Error('Request for TGT from restletIntegration failed!'));
      }
    });
  }
}

module.exports = getProxyTicketThroughRestletReq;