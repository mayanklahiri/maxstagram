var log = require('winston')
  , path = require('path')
  , util = require('util')
  , fork = require('child_process').fork
  ;

module.exports = util;

// Set up logging and override util.log
log.remove(log.transports.Console);
log.add(log.transports.Console, {colorize: true, timestamp: true});
util.log = log;

util.mergeInto = function(dest, src) {
  if (dest && src)
    for (var key in src)
      dest[key] = src[key];
  return dest;
}

util.extract = function(obj, keys) {
  var result = {};
  if (obj)
    for (var i = 0; i < keys.length; i++)
      result[keys[i]] = obj[keys[i]];
  return result;
}

util.resolvePaths = function(obj) {
  if (obj)
    for (var key in obj) {
      if (key.substr(0, 4) == 'dir_')
        obj[key] = path.resolve(obj[key]);
    }
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
  for (var i = 0; i < extension.length; i++)
    base.push(extension[i]);
}


util.launch = {};
util.launch.supervise = function(module_path, config) {
  util.ensure(module_path, []);
  var _G = {
    child: null,
    restarted: new Date().getTime(),
    backoff: 1,
    env: {
      config: JSON.stringify(config),
    },
  };

  function _restart(event_type) {
    var time_since_restart = new Date().getTime() - _G.restarted;
    _G.restarted = new Date().getTime();
    _G.backoff = (time_since_restart < 30000) ? util.min(_G.backoff * 2, 5000) : 1;
    setTimeout(function() {
      _G.child = fork(module_path, [], {env: _G.env});
      _G.child.on('error', _restart.bind('error'));
      _G.child.on('exit', _restart.bind('exit'));
      log.info(util.format('supervise: started %s, pid=%d backoff=%dms last_restart_delta=%dms',
                           module_path,
                           _G.child.pid,
                           _G.backoff,
                           time_since_restart));
    }, _G.backoff);
  }
  _restart('starting');
}

util.launch.cron = function(module_path, config, options) {
  util.ensure(options, ['pauseBetweenRunsSeconds']);
  var _G = {
    child: null,
    running: false,
    launched: null,
    env: {
      config: JSON.stringify(config),
    },
  };

  function _launch() {
    _G.child = fork(module_path, [], {env: _G.env});
    _G.launched = new Date().getTime();
    _G.child.on('exit',  function() {
      setTimeout(_launch, options.pauseBetweenRunsSeconds * 1000);
    });
  }

  _launch();
  log.info(util.format('Cronning %s at %d seconds',
                       module_path,
                       options.pauseBetweenRunsSeconds));
}