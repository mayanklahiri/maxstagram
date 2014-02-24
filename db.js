var mongoose = require('mongoose')
  , util = require('./util')
  , log = util.log
  ;


var SCHEMA = {
  uploads: {
    hash: {type: String, index: true, unique: true},
    size: {type: Number},
    name: {type: String},
    type: {type: String},
    path: {type: String},
    email: {type: String},
    received: {type: Date},
    remote_ip: {type: String},
    _reprocess_after: {type: Number, index: true},
  },
  base: {
    email: {type: String},
    received: {type: Date},
    hash: {type: String, index: true, unique: true},
    name: {type: String},
    num_to_derive: {type: Number, index: true},
    _reprocess_after: {type: Number, index: true},
  },
  derived: {
    base_hash: {type: String, index: true},
    path: {type: String},
    generated: {type: Date, index: true},
    params: {type: String},
    gen_time: {type: Number},
  },
};
var MODELS = {};


exports.init = function(config, cb) {
  if (!config.mongodb_server)
    return cb('Configuration does not specify "mongodb_server" parameter.');

  mongoose.connect(config.mongodb_server, {
    server: { poolSize: 3 },
  });
  mongoose.connection.on('error', cb);
  mongoose.connection.once('open', function() {
    _setupSchema(cb);
  });
}

// Convert schema to models
function _setupSchema(cb) {
  for (var table in SCHEMA) {
    var schema = new mongoose.Schema(SCHEMA[table]);
    MODELS[table] = mongoose.model(table, schema);
  }
  return cb();
}

exports.QueueForProcessing = function(table, object, cb) {
  if (!table || !object)
    return cb('No table or object specified.');
  object._reprocess_after = new Date().getTime();
  var obj = new MODELS[table](object);
  obj.save(function(err, doc) {
    cb(err, doc?doc.toObject():null);
  });
}

exports.PullForProcessing = function(table, lock_duration, cb) {
  var Model = MODELS[table];
  var query = {
    _reprocess_after: { '$lt': new Date().getTime() },
  };
  var update = {
    '$inc': { '_reprocess_after': lock_duration },
  };
  var options = {
    'new': true,
    'upsert': false,
  };
  Model.findOneAndUpdate(query, update, options, cb);
}

exports.MarkAsProcessed = function(table, query, cb) {
  var Model = MODELS[table];
  Model.update(query, {'$unset': {'_reprocess_after':true}}, cb);
}
