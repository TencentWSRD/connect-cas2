var globalPGTStore = require('./globalStoreCache');
var getProxyTickets = require('./getProxyTicket');
var utils = require('./utils');
var url = require('url');
var co = require('co');

/**
 *
 * @param req
 * @param targetService
 * @param {Object}  restletOptions            (Required)
 * @param {String}  restletOptions.name       (Required)
 * @param {Object}  restletOptions.params     (Required)
 * @param {Boolean} restletOptions.doNotRetry (Optional)
 * @param callback
 */
// restletIntegrateRuleKey, restletIntegrateOption, doNotRetry
function getProxyTicketThroughRestletReq(req, res, targetService, restletOptions, callback) {
  var options = this.options;
  var that = this;
  var logger = utils.getLogger(req, options);
  var doNotRetry = restletOptions.doNotRetry;
  var restletParams = restletOptions.params;
  var isUsingCache = restletOptions.cache;
  var restletIntegrateRuleKey = restletOptions.name;// 兼容之前，使用name作为cache key
  if (restletOptions.getRestletIntegrateRuleKey && typeof restletOptions.getRestletIntegrateRuleKey === 'function') {
    restletIntegrateRuleKey = restletOptions.getRestletIntegrateRuleKey(req);
  }

  var pgt = isUsingCache ? globalPGTStore.get(restletIntegrateRuleKey) : null;

  function retryHandler(err) {
    if (doNotRetry === true) {
      logger.info('Use cached pgt request failed, but doNotRetry set to true, use original callback with err', err);
      return callback(err);
    }
    logger.info('Use cached pgt request failed, maybe expired, retry once.');

    globalPGTStore.remove(restletIntegrateRuleKey);

    // Set doNotRetry=true, retry once, no more.
    getProxyTicketThroughRestletReq.call(that, req, res, targetService, {
      name: restletOptions.name,
      params: restletParams,
      doNotRetry: true,
      getRestletIntegrateRuleKey: restletOptions.getRestletIntegrateRuleKey,
    }, callback);
  }

  if (pgt) {
    logger.info('Find PGT for ' + restletIntegrateRuleKey + ' succeed from cache, PGT: ', pgt);
    // Don't use cache for a restlet PT, because they are special and will effect the normal PT by a logined user.
    return getProxyTickets.call(that, req, res, {
      targetService: targetService,
      specialPgt: pgt,
      disableCache: true,
      retryHandler: retryHandler
    }, callback);
  } else {
    var path = utils.getPath('restletIntegration', options);
    var startTime = Date.now();
    logger.info('Send request to ' + path + ' to get PGT.');
    utils.postRequest(path, restletParams, function (err, response) {
      logger.access('|POST|' + path + '|' + (err ? 500 : response.status) + "|" + (Date.now() - startTime));
      if (err) {
        logger.error('Request to get PGT through restletIntegration failed.');
        logger.error(err.message);
        return callback(err);
      }

      if (!response) {
        logger.error('Receive empty response from restletIntegration from CAS server');
        return callback(new Error('Receive empty response from restletIntegration from CAS server'));
      }

      if (response.status === 200 || response.status === 201) {
        logger.info('Request to get PGT through restlet integration succeed, status: ' + response.status);
        pgt = parseResponse(response.body);

        if (pgt) {
          logger.info('Parse pgtId from response succeed, pgt: ', pgt);
          globalPGTStore.set(restletIntegrateRuleKey, pgt);

          logger.info('Trying to get PT using restletIntegration PGT.');
          // Don't use cache for a restlet PT, because they are special and will effect the normal PT by a logined user.
          return getProxyTickets.call(that, req, res, {
            targetService: targetService,
            specialPgt: pgt,
            disableCache: true,
            retryHandler: retryHandler
          }, callback);
        } else {
          logger.info('Parse pgt from response failed!, response: ', response);
          return callback(new Error('Not a valid response from CAS Server!'));
        }
      } else {
        logger.error('Request for PT from restletIntegration failed!');
        logger.info(response);
        return callback(new Error('Request for TGT from restletIntegration failed!'));
      }
    });
  }
}

/**
 *
 * @param req
 * @param targetService
 * @param {Object}  restletOptions            (Required)
 * @param {String}  restletOptions.name       (Required)
 * @param {Object}  restletOptions.params     (Required)
 * @param {Boolean} restletOptions.doNotRetry (Optional)
 * @param callback
 */
// restletIntegrateRuleKey, restletIntegrateOption, doNotRetry
var getProxyTicketThroughRestletReqDcache = co.wrap(function* (req, res, targetService, restletOptions, callback) {
  var options = this.options;
  var that = this;
  var logger = utils.getLogger(req, options);
  var doNotRetry = restletOptions.doNotRetry;
  var restletParams = restletOptions.params;
  var isUsingCache = restletOptions.cache;
  var restletIntegrateRuleKey = restletOptions.name;// 兼容之前，使用name作为cache key
  var dcachePgtStore = restletOptions.restletCache.cache;
  if (restletOptions.getRestletIntegrateRuleKey && typeof restletOptions.getRestletIntegrateRuleKey === 'function') {
    restletIntegrateRuleKey = restletOptions.getRestletIntegrateRuleKey(req);
  }

  var pgt = null;
  if (isUsingCache) {
    pgt = yield dcachePgtStore.get(restletIntegrateRuleKey);
  }

  function retryHandler(err) {
    if (doNotRetry === true) {
      logger.info('Use cached pgt request failed, but doNotRetry set to true, use original callback with err', err);
      return callback(err);
    }
    logger.info('Use cached pgt request failed, maybe expired, retry once.');

    dcachePgtStore.remove(restletIntegrateRuleKey);

    // Set doNotRetry=true, retry once, no more.
    getProxyTicketThroughRestletReqDcache.call(that, req, res, targetService, {
      name: restletOptions.name,
      params: restletParams,
      doNotRetry: true,
      getRestletIntegrateRuleKey: restletOptions.getRestletIntegrateRuleKey,
      restletCache: restletOptions.restletCache,
    }, callback);
  }

  if (pgt) {
    logger.info('Find PGT for ' + restletIntegrateRuleKey + ' succeed from cache, PGT: ', pgt);
    // Don't use cache for a restlet PT, because they are special and will effect the normal PT by a logined user.
    return getProxyTickets.call(that, req, res, {
      targetService: targetService,
      specialPgt: pgt,
      disableCache: true,
      retryHandler: retryHandler
    }, callback);
  } else {
    var path = utils.getPath('restletIntegration', options);
    var startTime = Date.now();
    logger.info('Send request to ' + path + ' to get PGT.');
    utils.postRequest(path, restletParams, function (err, response) {
      logger.access('|POST|' + path + '|' + (err ? 500 : response.status) + "|" + (Date.now() - startTime));
      if (err) {
        logger.error('Request to get PGT through restletIntegration failed.');
        logger.error(err.message);
        return callback(err);
      }

      if (!response) {
        logger.error('Receive empty response from restletIntegration from CAS server');
        return callback(new Error('Receive empty response from restletIntegration from CAS server'));
      }

      if (response.status === 200 || response.status === 201) {
        logger.info('Request to get PGT through restlet integration succeed, status: ' + response.status);
        pgt = parseResponse(response.body);

        if (pgt) {
          logger.info('Parse pgtId from response succeed, pgt: ', pgt);
          dcachePgtStore.set(restletIntegrateRuleKey, pgt);

          logger.info('Trying to get PT using restletIntegration PGT.');
          // Don't use cache for a restlet PT, because they are special and will effect the normal PT by a logined user.
          return getProxyTickets.call(that, req, res, {
            targetService: targetService,
            specialPgt: pgt,
            disableCache: true,
            retryHandler: retryHandler
          }, callback);
        } else {
          logger.info('Parse pgt from response failed!, response: ', response);
          return callback(new Error('Not a valid response from CAS Server!'));
        }
      } else {
        logger.error('Request for PT from restletIntegration failed!');
        logger.info(response);
        return callback(new Error('Request for TGT from restletIntegration failed!'));
      }
    });
  }
});

/**
 * 解析出pgt
 * @param body
 * @return {String} pgtId
 */
function parseResponse(body) {
  var pgt = '';
  var result = body.match(/action="([\s\S]*?)"/);
  if (result) {
    result = result[1];

    var uri = url.parse(result, true);
    var pathname = uri.pathname;

    pgt = pathname.substr(pathname.lastIndexOf('/') + 1);
  }

  return pgt;
}

module.exports = {
  getProxyTicketThroughRestletReq,
  getProxyTicketThroughRestletReqDcache,
};

