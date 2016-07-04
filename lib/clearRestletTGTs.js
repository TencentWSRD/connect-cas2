var globalStore = require('./globalStoreCache');
var utils = require('./utils');
var request = require('urllib-sync').request;

function clearRestletTGTs(options, logger) {
  logger.info('Start to clear restlet tgts');
  var tgts = globalStore.getAll();
  var deleteTgtPath = utils.getPath('restletIntegration', options);

  for (var i in tgts) {
    logger.info('Request to ' + deleteTgtPath + '/' + tgts[i] + ' to delete tgt.');
    var res = request(deleteTgtPath + '/' + tgts[i], {
      method: 'DELETE'
    });

    if (res.status == 200) logger.info('Delete tgt succeed!');
    else logger.info('Delete tgt failed, status: ' + res.status);
  }

  globalStore.clear();
}

module.exports = clearRestletTGTs;