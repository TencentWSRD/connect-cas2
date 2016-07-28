function setCookies(headers) {
  if (!headers) headers = {};

  var cookies = {};

  if ('set-cookie' in headers) {
    headers['set-cookie'].forEach(function(cookie) {
      var cookieArr = cookie.split(';');

      var keyValuePair = cookieArr[0].split('=');

      cookies[keyValuePair[0]] = keyValuePair[1];
    });
  }

  return cookies;
}

function getCookies(cookies) {
  if (!cookies) cookies = {};

  var cookieArr = [];

  for (var i in cookies) {
    cookieArr.push(i + '=' + cookies[i]);
  }

  return cookieArr.join('; ');
}

module.exports = {
  getCookies: getCookies,
  setCookies: setCookies
};