// The Maxstagram image processing engine.
//
//     1. Pulls an item from the 'base' queue marked with `_reprocess_after`
//     2. Generates a randomly filtered image and its thumbnails.
//     3. Pushes an indexing record to the 'derived' table.
//     4. Pushes a notification request to the 'notifications' queue.
//     5. If `_num_to_generate` on the item is 0, mark item as done by deleting `_reprocess_after`.
//        Otherwise, set `_reprocess_after` to current time to release the lock.
//

var init = require('../init')
  , util = require('../util')
  , image = require('../image')
  , db = require('../db')
  , os = require('os')
  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  ;

var TIMEOUT = 1000 * 120; // 120 seconds

function main() {
  db.Queue.ProcessQueueItem('base', ProcessImage, TIMEOUT);
}

function ProcessImage(base_obj, cb) {
  var log = init.log;
  var config = init.config;

  // The object that will be pushed to the 'derived' table for indexing.
  var derived = {
    base_hash:  base_obj.hash,
    gen_id:     util.randHex(12),
    name:       base_obj.name,
    remote_ip:  base_obj.remote_ip,
    email:      base_obj.email,
    received:   base_obj.received,
    started:    new Date(),         // time this round started
    generated:  null,               // time this round finished
  };
  log.info('ImageProcessor: pulled queue item', util.logsafe(base_obj));

  // Figure out filenames for processing
  var in_file = null;
  for (var i = 0; i < base_obj.output_files.length; i++)
    if (base_obj.output_files[i].match(/-largest.jpg/)) {
      derived.in_file = base_obj.output_files[i];
      break;
    }
  if (!derived.in_file)
    return cb('Base item did not have a "-largest.jpg" suffix output file', base_obj);
  var out_file_base = path.join(config.dir_derived, base_obj.hash) + '-' + derived.gen_id;
  var tmp_file_base = path.join(os.tmpdir(), base_obj.hash) + process.pid;
  var fx_file = tmp_file_base + '-fx.jpg';
  var out_file = out_file_base + '.jpg';

  // Series execution: generate a random sequence of effects -> fx_file
  var exec_seq = [];
  exec_seq.push(function(next) {
    var num_ops = util.randint(config.img_max_fx_ops-config.img_min_fx_ops) +
                  config.img_min_fx_ops;
    derived.fx_params = image.GenerateEffectsLayer(num_ops);
    image.Process(derived.in_file, fx_file, derived.fx_params, next);
  });

  // Series execution: blend effects layer into original image -> out_file
  exec_seq.push(function(next) {
    derived.blend_params = image.GenerateBlendLayer();
    var b = derived.blend_params.slice();
    b.splice(0, 0, fx_file);
    image.Process(derived.in_file, out_file, b, next);
  });

  // Series execution: generate resized versions -> out_file-largest.jpg, out_file-large.jpg, etc.
  exec_seq.push(function(next) {
    image.MultiResize(out_file, out_file_base, config.img_dims, '80', function (err, output_files) {
      if (err || !output_files || !output_files.length) return next('MultiResize had an error', err);
      derived.output_files = output_files;
      next();
    });
  });

  // Series execution: generate entry in 'derived' table
  exec_seq.push(function(next) {
  	derived.generated = new Date().getTime();
    derived.walltime_sec = (derived.generated - derived.started) / 1000;
  	db.Insert('derived', derived, next);
  });

  // Series execution: update num_to_derive count on queue item
  exec_seq.push(function(next) {
    var query = {_id: base_obj._id};
    if (base_obj.num_to_derive > 1) {
      // Still more images to derive for this item
      db.Update('base',  // table
                query,   // base_obj identifier
                {        // update operation
                  '$inc': {num_to_derive: -1},  // decrease num_to_derive
                  '$set': {_reprocess_after: new Date().getTime()}  // release queue lock
                },
                next);
      return;
    }

    // No more derivations left for this image. Mark it as done in
    // the queue so that it won't be pulled again by any process.
    async.series([
      function (link) {
        log.info('ImageProcessor: marking as processed', util.logsafe(query));
        db.Queue.MarkAsProcessed('base', query, link);
      },
      function (link) {
        var notification = {
          email: base_obj.email,
          base_hash: base_obj.hash,
          name: base_obj.name,
          received: base_obj.received,
          type: 'new_images_available',
        };
        log.info('ImageProcessor: queueing notification', util.logsafe(notification));
        db.Queue.QueueForProcessing('notifications', notification, link);
      }
    ], next);
  });

  // Series terminator: clean up and print a logline
  async.series(exec_seq, function (err, detail) {
    try {
      fs.unlinkSync(fx_file);
    } catch(e) {}
    if (!err) log.info('ImageProcessor: finished image', util.logsafe(derived));
    cb(err, detail);
  });
}

if (require.main === module) init.Init(null, main);
