// Monkey-patches the standard 'util' library with some additions.
var log = require('winston')
  , fs = require('fs')
  , path = require('path')
  , util = require('util')
  , jade = require('jade')
  , async = require('async')
  , fork = require('child_process').fork
  , mongodb = require('mongodb')
  , _ = require('winston-mongodb').MongoDB
  , schema = require('./schema')
  ;

module.exports = util;

var TEMPLATES = {};
var JADE_OPTIONS = {
  pretty: true,
};
var G = {};

// Shallow object clone
util.clone = function(obj) {
  var r = {};
  for (var k in obj)
    r[k] = obj[k];
  return r;
}

// Set up logging and override util.log
// Check ImageMagick compliance
util.init = function(config, cb) {
  log.remove(log.transports.Console);

  var options = util.clone(config.mongodb);
  options.collection = 'logs';
  options.storeHost = true;
  options.safe = true;
  log.add(log.transports.MongoDB, options);

  log.add(log.transports.Console, {
    colorize: true,
    timestamp: true,
  });

  G.config = config;
  util.log = log;

  require('./image').Init(config, cb);
}

util.init_db = function(cb) {
  if (!G.config) throw new Error('util.init() not called.');
  if (G.db) return cb ? cb() : null;

  var MongoClient = mongodb.MongoClient;
  var MongoServer = mongodb.Server;
  var mongo_server = new MongoServer(G.config.mongodb.host || 'localhost',
                                     G.config.mongodb.port || 27017,
                                     {logger: null});
  var mongo_client = new MongoClient(mongo_server, {
    journal: true,
  });
  mongo_client.open(function (err, client) {
    if (err) return cb ? cb(err) : null;
    G.db = client.db(G.config.mongodb.db);

    var exec_seq = [];
    for (var index_name in schema.indices)
      exec_seq.push(function (index_name, index) {
        return function (next) {
          G.db.collection(index.collection).ensureIndex(
              index.definition,
              index.options,
              next);
        };
      }(index_name, schema.indices[index_name]));

    async.series(exec_seq, function (err) {
      cb && cb(err, G.db);
    });
  });
}

// Retrieve DB reference
util.db = function(cb) {
  if (!G.db)
    return util.init_db(cb);
  return cb(null, G.db);
}

// Retrieve log tail
util.log_tail = function(cb) {
  if (!G.config) throw new Error('util.init() not called.');
  if (!cb) return;
  if (!G.db) util.init_db(fn);
  if (G.db) fn();

  function fn(err) {
    if (err) throw err;
    if (!G.db) throw new Error('database connection failed.');
    G.db.collection('logs').find({}, null, {
      sort: [['timestamp', -1]],
      limit: 100,
    }).toArray(cb);
  }
}

// Deals with quirks in the Winston MongoDB transport when logging metadata
util.logsafe = function(obj) {
  var n = util.clone(obj);
  n.__id = n._id;
  delete n._id;
  return n;
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
    var template_path = path.join(G.config.dir_templates || 'templates',
                                  template_name);
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
  if (typeof base != 'object') throw new ValueError('base should be an array.');
  if (typeof extension != 'object') throw new ValueError('extension should be an array.');
  for (var i = 0; i < extension.length; i++)
    base.push(extension[i]);
}

// Process supervisor
util.launch = function(module_path, config, options) {
  util.ensure(module_path, []);
  util.ensure(config, []);
  options = util.mergeInto({
    exponential_backoff: false,
  }, options || {});

  // State for the process we are about to create
  var _G = {
    child: null,
    spawned: null,
    backoff: 1,
    env: {
      config: JSON.stringify(config),
    },
  };

  _fork();

  // Fork a subprocess
  function _fork() {
    _G.spawned = new Date();
    _G.child = fork(module_path, [], {env: _G.env});
    _G.child.on('error', function(e) { return _child_exit('error', e); });
    _G.child.on('exit', function(e) { return _child_exit('exit', e); });
    if (options.log_events)
      log.info(util.format('launch:fork: %s pid=%d', module_path, _G.child.pid));
  }

  // Handle a subprocess exiting
  function _child_exit(event_type, event) {
    var time_since_fork_sec = (new Date() - _G.spawned) / 1000;

    if (options.log_events) {
      var msg = util.format('launch:%s: %s pid=%d runtime=%ds',
                            event_type, module_path, _G.child.pid, time_since_fork_sec);
      if (event_type == 'error')
        log.error(msg);
      if (event_type == 'exit')
        log.info(msg);
    }

    // Re-launch process
    var wait_interval = 0;
    if (options.exponential_backoff) {
      _G.backoff = (time_since_fork_sec < 20) ? util.min(_G.backoff * 2, 5000) : 1;
      wait_interval = _G.backoff;
    }
    setTimeout(_fork, wait_interval);
  }
}


