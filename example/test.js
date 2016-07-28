// var http = require('http');
// var url = require('url');
//
// var uri = url.parse('http://10.17.86.87:8080');
//
// uri.method = 'get';
//
// console.log('send request to path: ', uri);
//
// var chunks = [];
//
// var req = http.request(uri, function(res) {
//   console.log('res');
//   res.setEncoding('utf8');
//   res.on('data', function(chunk) {
//     console.log('on data');
//     chunks.push(chunk);
//   });
//   res.on('end', function() {
//     console.log('response', {
//       status: res.statusCode,
//       body: chunks.join(''),
//       header: res.headers
//     });
//   });
// });
//
// req.on('error', function(e) {
//   console.error('on error', e);
//   console.error(e);
// });
//
// console.log('end');
// req.end();

// var urllib = require('urllib');
//
// urllib.request('http://rdmdev.oa.com/buglycas/v1/tickets/xxxx', {
//   method: 'DELETE'
// }, function(err, data, res) {
//   if (err) throw err;
//   console.log('data', data);
//   console.log('status', res.status);
// });

var Express = require('express');
var http = require('http');

var app = new Express();

app.get('/', function(req, res) {
  res.send('ok');
});

app.delete('/cas/v1/tickets/:tgt', function(req, res) {
  console.log('hi');
  res.send('ok');
});

var server = http.createServer(app);

server.listen(3004, function(err) {
  if (err) throw err;
});
