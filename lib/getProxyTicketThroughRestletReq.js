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
 */
function getProxyTicketThroughRestletReq(req, targetService, restletIntegrateRuleKey, restletIntegrateOption, logger, callback) {
  var options = this.options;
  var that = this;

  var pgt = globalPGTStore.get(restletIntegrateRuleKey);

  if (pgt) {
    if (!req.session) req.session = {};
    req.session.pgt = pgt;
    logger.info('Find PGT for ' + restletIntegrateRuleKey + ' succeed, PGT: ', pgt);
    return getProxyTickets.call(that, req, targetService, callback, logger);
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