var globalStore = require('./globalStoreCache');
var utils = require('./utils');

function clearRestletTGTs(options, logger, callback) {
  logger.info('Start to clear restlet tgts');
  var tgts = globalStore.getAll();
  var deleteTgtPath = utils.getPath('restletIntegration', options);

  var queueArr = [], index = 0;

  for (var i in tgts) {
    queueArr.push(deleteTgtPath + '/' + tgts[i]);
  }

  execQueue(queueArr[index], function next(err, response) {
    if (!err && !response) {
      globalStore.clear();
      return callback();
    }

    if (err) {
      logger.warn('Request to delete TGT failed!');
      logger.error(err);
    }

    index++;
    execQueue(queueArr[index], next);
  });


  function execQueue(path, next) {
    if (!path) return next();
    var startTime = Date.now();
    utils.deleteRequest(path, function (err, response) {
      logger.access('|DELETE|' + path + '|' + (err ? 500 : response.status) + "|" + (Date.now() - startTime));
      if (err) next(err);

      next(null, response);
    });
  }
}

module.exports = clearRestletTGTs;