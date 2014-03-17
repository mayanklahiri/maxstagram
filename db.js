// Database abstraction implemented using MongoDB.
var init = require('./init')
  , util = require('./util')
  ;

exports.Update = function (table, query, update, cb) {
  if (!table || !update || !query) throw new Error('No table or object specified.');
  init.dbi.collection(table).update(query, update, {
    upsert: false,
    journal: true,
    multi: false,
  }, function (err, num_updated) {
    if (!num_updated) init.log.warning('Update caused num_updated=0', {
      table: table,
      query: query,
      update: update,
    });
    util.checkErrorAndReturn(err, __where, 'mongodb.Update failed'+err, cb);
  });
}

exports.Query = function (table, query, sort, limit, cb) {
  if (!table || !query || !sort || !limit || !cb) throw new Error('Invalid arguments.');
  var options = {
    sort: sort,
    limit: limit,
  };
  init.dbi.collection(table).find(query, options).toArray(cb);
}

exports.Insert = function (table, object, cb) {
  if (!table || !object) throw new Error('No table or object specified.');
  object._created = new Date();
  init.dbi.collection(table).insert(object, {}, cb);
}

exports.FindAndModify = function (table, query, sort, update, options, cb) {
  init.dbi.collection(table).findAndModify(query, sort, update, options, cb);
}

// A simple task queue that relies on an atomic findAndModify() implementation
// and reasonably accurate clocks for locking.
exports.Queue = {
  QueueForProcessing: function(table, object, cb) {
    if (!table || !object) throw new Error('No table or object specified.');
    object._reprocess_after = new Date().getTime();
    object._failures = 0;
    object._successes = 0;
    object._queue_time = new Date();
    exports.Insert(table, object, cb);
  },

  PullForProcessing: function(table, lock_duration_sec, cb) {
    if (!table || !lock_duration_sec) throw new Error('No table or lock duration specified.');
    var query = {
      _reprocess_after: {'$lt': new Date().getTime()},
      _failures: {'$lt': init.config.max_task_failures || 10},
    };
    var sort = {
      _queue_time: 1
    };
    var update = {
      '$inc': {_reprocess_after: lock_duration_sec},
    };
    var options = {
      'new': true,    // return new object
      'upsert': false,
    };
    exports.FindAndModify(table, query, sort, update, options, cb);
  },

  MarkAsProcessed: function(table, query, cb) {
    var update = {
      '$unset': {
        _reprocess_after: true
      },
      '$inc': {
        _successes: 1,
      },
    };
    exports.Update(table, query, update, cb);
  },

  MarkAsFailed: function(table, query, cb) {
    var update = {
      '$inc': {
        _failures: 1,
      },
    };
    exports.Update(table, query, update, cb);
  },

  // Syntactic sugar
  ProcessQueueItem: function(table, processor, timeout, poll_delay) {
    timeout = timeout || 60000;  // default timeout: 60 seconds
    poll_delay = poll_delay || 5000;  // default poll delay: 5 seconds

    // Pull an item from the work queue and process it.
    // On success, exit immediately with error code 0.
    // On timeout, exit with a poll delay and error code 1980.
    // On failure, log the error,
    //             mark the queue item with failure,
    //             exit with a poll delay and error code 500.
    // On empty queue, exit with a poll delay and error code 0.
    exports.Queue.PullForProcessing(table, timeout, function (err, q_item) {
      var log = init.log;
      if (err) return setTimeout(process.exit.bind(500), poll_delay);
      if (!q_item) return setTimeout(process.exit.bind(0), poll_delay);
      var start_time = new Date();
      processor(q_item, function(err, new_q_item) {
        var time_delta = new Date() - start_time;
        if (err) {
          log.error(util.format('ProcessQueueItem:%s: item aborted, %dms',
                                table, time_delta),
                    util.logsafe({doc: q_item, err:err}));
          if (q_item._id)
            exports.Queue.MarkAsFailed(table, {_id: q_item._id}, function() {
              setTimeout(process.exit.bind(500), poll_delay);
            });
        } else {
          log.info(util.format('ProcessQueueItem:%s: item finished, %dms',
                                    table, time_delta),
                   util.logsafe(q_item));
          process.exit(0);
        }
      });
    });

    // Kill this process after timeout
    setTimeout(process.exit.bind(1980), timeout);
  },
}

// Retrieve log tail
exports.log_tail = function(cb) {
  if (!init.dbi) throw new Error('init.Init() not called.');
  init.dbi.collection('logs').find({}, null, {
    sort: [['timestamp', -1]],
    limit: 100,
  }).toArray(cb);
}
