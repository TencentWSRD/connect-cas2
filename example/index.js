var path = require('path');
var http = require('http');
var Express = require('express');
var app = new Express();

var appConfig = require('./appConfig');

appConfig(app);

app.get('/api', function(req, res) {
  var service = 'http://ciserver.et.wsd.com/ciserver3.0';

  // var service = 'http://betaserverpre.et.wsd.com/betaserverv2';
  req.getProxyTicket(service + '/shiro-cas', function(err, pt) {
    if (err) {
      console.log('getProxyTicket error');
      console.log(err);
      return res.status(500).send(JSON.stringify(err));
    }

    var destPath = service + '/job/14150?' + require('query-string').stringify({
        target: 'new',
        ticket: pt
      });

    console.log('sending request to ', destPath);

    require('../lib/utils').getRequest(destPath, function(err, response) {
      res.send(response);
    });
  })
});

app.get('/', function(req, res) {
  res.render('index.ejs');
});

app.get('/clear', function(req, res) {
  req.clearRestlet();
  console.log('this means it is sync!');
  res.send('ok');
});

var server = http.createServer(app);

server.listen(8080, function(err) {
  if (err) throw err;
  console.log('App is now listening to port 8080.');
});