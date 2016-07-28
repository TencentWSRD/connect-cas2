var utils = require('./utils');

var args = {};

try {
  args = process.argv[2] || '';
  args = JSON.parse(args);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

utils.sendRequest(args.url, args.options, function(err, response) {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }

  console.log(JSON.stringify(response));
  process.exit(0);
});