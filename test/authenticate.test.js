var expect = require('chai').expect;
var request = require('http').request;
var url = require('url');

describe('校验判断登陆状态', function() {
  var apiUrl = 'http://10.17.86.87:8080/api';
  var apiUri = url.parse(apiUrl);

  it('session中无pt, 跳登录页', function() {

    request(apiUri, function(err, response) {

    });
  });
});