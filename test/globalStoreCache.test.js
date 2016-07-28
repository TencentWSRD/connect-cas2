var globalStoreCache = require('../lib/globalStoreCache');
var expect = require('chai').expect;

describe('globalStoreCache工作正常', function() {

  var key = 'key',
    value = 'value';

  it('功能一切正常', function() {
    globalStoreCache.set(key, value);

    expect(globalStoreCache.contains(key)).to.be.true;

    expect(globalStoreCache.get(key)).to.equal(value);

    globalStoreCache.remove(key);

    expect(globalStoreCache.get(key)).to.be.empty;

    globalStoreCache.set(key, value);

    var all = globalStoreCache.getAll();

    expect(all[key]).to.equal(value);

    globalStoreCache.clear();

    all = globalStoreCache.getAll();

    var isEmpty = true;
    for (var i in all) {
      isEmpty = false;
      break;
    }

    expect(isEmpty).to.equal.true;
  });


});