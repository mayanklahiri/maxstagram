// Database abstraction, implemented using MongoDB through the Mongoose ODM.
var util = require('./util');

exports.Update = function (table, query, update, cb) {
  if (!table || !update || !query) throw new Error('No table or object specified.');
  util.db(function(err, db) {
    if (err || !db) return cb(err, db);
    db.collection(table).update(query, update, {
      upsert: false,
      journal: true,
      multi: false,
    }, cb);
  });
}

exports.Query = function (table, query, sort, limit, cb) {
  if (!table || !query || !sort || !limit || !cb) throw new Error('Invalid arguments.');
  util.db(function(err, db) {
    if (err || !db) return cb(err, db);
    var options = {
      sort: sort,
      limit: limit,
    };
    db.collection(table).find(query, options).toArray(cb);
  });

}

exports.Insert = function (table, object, cb) {
  if (!table || !object) throw new Error('No table or object specified.');
  util.db(function(err, db) {
    if (err || !db) return cb(err, db);
    db.collection(table).insert(object, {}, cb);
  });
}

exports.Queue = {
  QueueForProcessing: function(table, object, cb) {
    if (!table || !object) throw new Error('No table or object specified.');
    object._reprocess_after = new Date().getTime();
    exports.Insert(table, object, cb);
  },

  PullForProcessing: function(table, lock_duration_sec, cb) {
    util.db(function (err, db) {
      if (err || !db) return cb(err, db);
      var query = {
        _reprocess_after: {'$lt': new Date().getTime()},
      };
      var sort = {
        received: 1
      };
      var update = {
        '$inc': {_reprocess_after: lock_duration_sec},
      };
      var options = {
        'new': true,    // return new object
        'upsert': false,
      };
      db.collection(table).findAndModify(query, sort, update, options, cb);
    });
  },

  MarkAsProcessed: function(table, query, cb) {
    util.db(function (err, db) {
      if (err || !db) return cb(err, db);
      db.collection(table).update(query, {'$unset': {'_reprocess_after':true}}, cb);
    });
  },

  MarkAsFailed: function(table, query, cb) {
    util.db(function (err, db) {
      if (err || !db) return cb(err, db);
      db.collection(table).update(query, {'$inc': {'_failed':1}}, cb);
    });
  },

  // Syntactic sugar
  ProcessQueueItem: function(table, processor, timeout, poll_delay) {
    timeout = timeout || 30000;  // default timeout: 30 seconds
    poll_delay = poll_delay || 3000;  // default poll delay: 3 seconds

    // Pull an item from the work queue and process it.
    // On success, exit immediately with error code 0.
    // On timeout, exit with a poll delay and error code 1980.
    // On failure, log the error,
    //             mark the queue item with failure,
    //             exit with a poll delay and error code 500.
    // On empty queue, exit with a poll delay and error code 0.
    exports.Queue.PullForProcessing(table, timeout, function (err, q_item) {
      if (err) return setTimeout(process.exit.bind(500), poll_delay);
      if (!q_item) return setTimeout(process.exit.bind(0), poll_delay);
      var start_time = new Date();
      processor(q_item, function(err, new_q_item) {
        var time_delta = new Date() - start_time;
        if (err) {
          util.log.error(util.format('ProcessQueueItem:%s: item aborted, %dms',
                                     table, time_delta),
                         {doc: q_item, err:err});
          if (q_item._id)
            exports.Queue.MarkAsFailed(table, {_id: q_item._id}, function() {
              setTimeout(process.exit.bind(500), poll_delay);
            });
        } else {
          delete q_item._id;
          util.log.info(util.format('ProcessQueueItem:%s: item finished, %dms',
                                    table, time_delta),
                        q_item);
          process.exit(0);
        }
      });
    });

    // Kill this process after timeout
    setTimeout(process.exit.bind(1980), timeout);
  },

}
