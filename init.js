// Common initialization for all processes.
//
// -- Provides an init.config object
//    -- If one was supplied to Init, that is used.
//    -- If process.env.config is a JSON string, it is decoded and used.
// -- Provides init.log to output to a MongoDB collection and console
// -- Provides init.dbi as a connected MongoDB client
//
var async = require('async')
  , fork = require('child_process').fork
  , log = require('winston')
  , mongodb = require('mongodb')
  , path = require('path')
  , schema = require('./schema')
  , util = require('./util')
  , _ = require('winston-mongodb').MongoDB
  ;

// Public module API
var Exports = {
  Init: Init,
  Launch: Launch,

  // Process-wide state
  log:    null,
  config: null,
  dbi:    null,
};
module.exports = Exports;

// All process should call this function on startup, and not do anything
// significant until the 'cb' callback has returned.
function Init(config, cb) {
  if (typeof __where != 'undefined')
    throw new Error('init.Init() called more than once.');

  async.series([
    _SetConfig,
    _SetupErrorHandling,
    _SetupLogging,
    _SetupDatabase,
    _SetupImageProcessing,
  ], function (err) {
    util.checkErrorAndReturn(err, __where, 'Init() failed.', cb);
  });


  function _SetConfig(next) {
    // Set process.env.config
    if (config && typeof config == 'object')
      Exports.config = config;
    else {
      if (process.env.config) {
        try {
          Exports.config = JSON.parse(process.env.config);
        } catch (e) {};
      }
    }
    Exports.config = Exports.config || {};
    next();
  }

  function _SetupErrorHandling(next) {
    // Adapted from:
    // http://stackoverflow.com/questions/11386492/accessing-line-number-in-v8-javascript-chrome-node-js
    Object.defineProperty(global, '__stack', {
      get: function(){
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function(_, stack){ return stack; };
        var err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
      }
    });

    Object.defineProperty(global, '__where', {
      get: function(){
        return path.basename(__stack[1].getFileName()) +
               ':' + __stack[1].getLineNumber() + ' ';
      }
    });
    next();
  }

  function _SetupLogging(next) {
    // Setup process.log logging
    var db_config = Exports.config.mongodb || {};
    log.remove(log.transports.Console);
    log.add(log.transports.MongoDB, {
      db:         db_config.db,
      host:       db_config.host,
      collection: db_config.collection || 'logs',
      safe:       true,
    });
    log.add(log.transports.Console, {
      colorize: true,
      timestamp: true,
    });
    Exports.log = log;
    next();
  }

  function _SetupDatabase(next) {
    var config = Exports.config;
    if (!config.mongodb) {
      Exports.log.info(__where + 'config.mongodb not specified, not connecting to MongoDB.')
      return next();
    }
    var MongoClient = mongodb.MongoClient;
    var MongoServer = mongodb.Server;
    var mongo_server = new MongoServer(config.mongodb.host || 'localhost',
                                       config.mongodb.port || 27017,
                                       {logger: null});
    var mongo_client = new MongoClient(mongo_server, {
      journal: true,
    });
    mongo_client.open(function (err, client) {
      if (util.checkError(err, __where, 'mongo_client.open() failed.', next))
        return;
      if (!client || !client.db)
        return util.checkError(client || {}, __where, 'mongo_client.open() did not return a MongoDB client');
      Exports.dbi = client.db(config.mongodb.db);

      // Ensure indices for all tables in the schema
      var exec_seq = [];
      for (var index_name in schema.indices)
        exec_seq.push(function (index_name, index) {
          return function (next_table) {
            Exports.dbi.collection(index.collection).ensureIndex(
                index.definition,
                index.options,
                next_table);
          };
        }(index_name, schema.indices[index_name]));

      // Run ensureIndices commands in series
      async.series(exec_seq, function (err) {
        util.checkErrorAndReturn(err, __where, 'mongo_client.collection.ensureIndex() failed.', next);
      });
    });
  }

  // Probe ImageMagick capabilities
  function _SetupImageProcessing(next) {
    require('./image').Init(Exports.config, next);
  }
}


// Process supervisor
function Launch(module_path, options) {
  util.ensure(module_path, []);
  util.ensure(process.config, []);
  options = util.mergeInto({
    exponential_backoff: false,
    log_events:          false,
  }, options || {});

  // Local state for the process we are about to create
  var _G = {
    child: null,
    spawned: null,
    backoff: 1,
    env: {
      config: JSON.stringify(Exports.config),
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


