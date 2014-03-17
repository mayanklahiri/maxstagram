// Monkey-patches the standard 'util' library with some additions.
var fs = require('fs')
  , path = require('path')
  , util = require('util')
  , jade = require('jade')
  , crypto = require('crypto')
  ;

module.exports = util;

var TEMPLATES = {};
var JADE_OPTIONS = {
  pretty: true,
};

// Shallow object clone
util.clone = function(obj) {
  var r = {};
  for (var k in obj)
    r[k] = obj[k];
  return r;
}

// Deals with quirks in the Winston MongoDB transport when logging metadata
util.logsafe = function(obj) {
  var n = util.clone(obj);
  if (n._id) {
    n.__id = n._id;
    delete n._id;
  }
  return n;
}

// Random hex string
util.randHex = function(len) {
  return crypto.randomBytes(len).toString('hex');
}

// Overrides dest's keys with src's keys
util.mergeInto = function(dest, src) {
  if (dest && src)
    for (var key in src)
      dest[key] = src[key];
  return dest;
}

// Generates HTML from a template
util.template = function(template_name, locals) {
  if (!TEMPLATES[template_name]) {
    var template_path = require('./init').config.dir_templates || 'templates';
    var template_path = path.join(template_path, template_name);
    JADE_OPTIONS.filename = template_name;
    TEMPLATES[template_name] = jade.compile(fs.readFileSync(template_path, 'utf8'),
                                            JADE_OPTIONS);
  }
  return TEMPLATES[template_name](locals);
}

util.extract = function(obj, keys) {
  var result = {};
  if (obj)
    for (var i = 0; i < keys.length; i++)
      result[keys[i]] = obj[keys[i]];
  return result;
}

util.ensure = function(obj, fields) {
  if (obj && fields) {
    for (var i = 0; i < fields.length; i++)
      if (!(fields[i] in obj))
        throw new Error(util.format(
          'Field "%s" not present in obj %s',
          fields[i],
          util.inspect(obj)));
  } else {
    throw new Error('Null parameters passed');
  }
}

util.min = function(a, b) {
  return a < b ? a : b;
}

util.randint = function(N) {
  return Math.floor(Math.random() * N);
}

util.choice = function(array) {
  if(!array) return;
  if(!array.length) return;
  return array[util.randint(array.length)];
}

util.extend = function(base, extension) {
  if (!base || !extension) return;
  if (typeof base != 'object') throw new ValueError('base should be an array.');
  if (typeof extension != 'object') throw new ValueError('extension should be an array.');
  for (var i = 0; i < extension.length; i++)
    base.push(extension[i]);
}

util.checkError = function (err, where, message, cb) {
  if (!err) return false;
  if (typeof err != 'object' || !err.length)
    err = [err];
  else
    err.push(where + message);
  if (cb) setTimeout(function() { cb(err) }, 0);
  return true;
}

util.checkErrorAndReturn = function (err, where, message, cb) {
  if (err) {
    if (typeof err != 'object' || !err.length)
      err = [err];
    else
      err.push(where + message);
  }
  cb(err);
}
