var mongoose = require('mongoose')
  , util = require('./util')
  , log = util.log
  ;


exports.init = function(config, cb) {
  if (!config.mongodb_server)
    return cb('Configuration does not specify "mongodb_server" parameter.');
  
  mongoose.connect(config.mongodb_server, {
    server: { poolSize: 3 },
  });
  mongoose.connection.on('error', cb);
  mongoose.connection.once('open', function() {
    log.info('DB: connected to MongoDB');
    _setupSchema(cb);
  });
}

function _setupSchema(cb) {
  // TODO: create and setup schema  
  return cb();
}

exports.QueueForProcessing = function(table, object, cb) {
  if (!table || !object)
    return cb('No table or object specified.');
  object.reprocess_after = new Date().getTime();  
  // TODO: save object to collection
}