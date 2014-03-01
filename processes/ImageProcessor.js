var db = require('../db')
  , os = require('os')
  , fs = require('fs')
  , path = require('path')
  , util = require('../util')
  , im = require('imagemagick')
  , async = require('async')
  , config = JSON.parse(process.env.config)
  , log = util.log
  ;

var TIMEOUT = 1000 * 600; // 600 seconds

function main() {
  db.init(config, function(err) {
    if (err) process.exit(-1);
    db.PullForProcessing('base', TIMEOUT, function (err, doc) {
      if (err || !doc) return process.exit(-2);
      ProcessImage(doc, function(err) {
        if (err) log.error('ProcessImage', err);
        process.exit(3);
      });
    });
  });
  setTimeout(process.exit, TIMEOUT);
}

function ProcessImage(base_obj, cb) {
  var base = path.join(config.dir_base, base_obj.hash);
  var in_file = util.format('%s-largest.jpg', base);
  var tmp_file_base = util.format('%s-%d',
                                  path.join(os.tmpdir(), base_obj.hash),
                                  process.pid);
  var fx_file = tmp_file_base + '-fx.jpg';
  var out_file_base = util.format('%s-%d',
                                  path.join(config.dir_derived, base_obj.hash),
                                  util.randint(100000));
  var out_file = out_file_base;

  log.info(util.format('ProcessImage: pulled in=%s out=%s email=%s num_to_derive=%d',
                       path.basename(in_file),
                       path.basename(out_file_base),
                       base_obj.email,
                       base_obj.num_to_derive));
  var derived = {};


  // Assemble execution sequence: generate effects layer
  var exec_seq = [];
  exec_seq.push(function(next) {
    var fx_params = GenerateEffectsLayer(in_file, fx_file);
    im.convert(fx_params, function (err, stdout) {
      if (err)
        log.error('ImageProcessor: gen-fx error:', stdout);
      else {
        fx_params.splice(0, 1);
        fx_params.splice(fx_params.length-1, 1);
        derived.params = {
          fx: fx_params,
        };
      }
      next(err);
    });
  });

  // Assemble execution sequence: blend effects layer
  exec_seq.push(function(next) {
    var blend_params = GenerateBlendLayer(in_file, fx_file, out_file);
    im.convert(blend_params, function (err, stdout) {
      if (err)
        log.error('ImageProcessor: gen-blend error:', stdout);
      else {
        blend_params.splice(0, 2);
        blend_params.splice(blend_params.length-1, 1);
        derived.params.blend = blend_params;
      }
      next(err);
    });
  });
  
  // Execution sequence: generate resized versions
  for (var dim_label in config.img_dims)
    exec_seq.push((function(dim_label, max_dim) {
      return function(next) {
        im.convert([
          out_file,
          '-strip',
          '-quality',
          '75',
          '-resize',
          util.format('%dx%d>', max_dim, max_dim),
          out_file_base + util.format('-%s.jpg', dim_label),
        ], function (err, stdout) {
          if (err) log.info('ImageProcessor: err=' + err, stdout);
          next(err);
        });

      };
    })(dim_label, config.img_dims[dim_label]));

  // Execution sequence: generate entry in 'derived' table
  exec_seq.push(function(next) {
  	derived.base_hash = base_obj.hash;
  	derived.path = out_file;
  	derived.params = JSON.stringify(derived.params);
  	derived.generated = new Date().getTime();
  	db.Push('derived', derived, next);
  });

  // Execution sequence: update derived count
  exec_seq.push(function(next) {
    base_obj.num_to_derive--;
    if (base_obj.num_to_derive <= 0) {
      base_obj['_reprocess_after'] = null;
      base_obj.num_to_derive = 0;
      
      // Queue notification to sender
      var notification = {
      	email: base_obj.email,
      	base_hash: base_obj.hash,
      	type: 'new_images_available',
      };      
      db.QueueForProcessing('notifications', notification);   
    } else
      base_obj['_reprocess_after'] = new Date().getTime();
    base_obj.save(next);
  });
  
  // Execution sequence: print a logline
  exec_seq.push(function(next) {
  	log.info('ProcessImage: finished', path.basename(in_file));
  	next();
  })

  async.series(exec_seq, cb);
}


function GenerateEffectsLayer(in_file, fx_file) {
  var cmd = [];
  for (var i = util.randint(config.img_max_fx_layers)+config.img_min_fx_layers; --i>=0; ) {
    var op = util.choice(OPERATORS);
    for (var j = 0; j < op.length; j++) {
      if (typeof op[j] == 'string')
        continue;
      if (typeof op[j] == 'object' && op[j].length) {
        if (typeof op[j][0] == 'number' && op[j].length == 2) {
          op[j] = Math.random() * (op[j][1] - op[j][0]) + op[j][0];
          continue;
        }
        if (typeof op[j][0] == 'string') {
          op[j] = util.choice(op[j]);
          continue;
        }
      }
    }
    util.extend(cmd, op.join('').split(' '));
  }
  cmd.splice(0, 0, in_file);
  cmd.push(fx_file);
  return cmd;
}

function GenerateBlendLayer(in_file, fx_file, out_file) {
  var op = util.choice(COMPOSE_METHODS);
  var cmd = [fx_file, in_file];
  var args = '';
  if (op == 'Blend' || op == 'Dissolve')
    // Blend and dissolve require a source percent
    args = util.randint(200);
  if (op == 'Modulate')
    // Modulate requires brightness and saturation percent
    args = util.format('%dx%d', util.randint(200), util.randint(200));
  if (op == 'Displace')
    // Displace requires an X-scale and Y-scale expressed as a percentage
    args = util.format('%dx%d%%',
                       util.randint(30),
                       util.randint(30));
  if (op == 'ChangeMask') {
    // ChangeMask requires a fuzz factor to be set before composite is called
    cmd.push('-fuzz');
    cmd.push(util.randint(100) + '%');
  }

  util.extend(cmd, [
    '-compose',
    op,
    '-define',
    'compose:args=' + args,
    '-composite',
    '-normalize',
    out_file
  ]);

  return cmd;
}

var NOISE_TYPES = ['Gaussian', 'Laplacian', 'Multiplicative', 'Poisson', 'Impulse'];
var COLOR_SPACES = ['XYZ', 'Gray', 'HWB', 'Log', 'YUV', 'HSB', 'Rec709Luma', 'YIQ',
                    'Lab', 'YCC', 'HSL', 'CMYK', 'OHTA', 'YCbCr', 'CMY'];
var STATISTICS = ['Maximum', 'Median', 'Mean', 'Mode', 'Gradient', 'Nonpeak'];
var COLORS = ['RoyalBlue1', 'darkcyan', 'goldenrod', 'firebrick', 'DarkOrange',
              'Navy', 'DarkGreen', 'DodgerBlue', 'Gold'];
var OPERATORS = [
    ['-adaptive-blur', ' ', [1.5, 5.0]],
    ['-adaptive-sharpen', ' ', [1.5, 5.0]],
    ['-auto-gamma',],
    ['-auto-level',],
    ['-blue-shift', ' ', [1.5, 5.0]],
    ['-blur', ' ', '0x', [1.0, 5.0]],
    ['-blur', ' ', '0x', [1.0, 5.0], ' -paint ', [1, 5]],
    ['-blur', ' ', '0x3 -negate', ' -edge ', [1, 5], ' -negate'],
    ['-brightness-contrast', ' ', [-50, 50], 'x', [-50, 50], '%'],
    ['-charcoal', ' ', [1, 10]],
    ['-colorspace', ' ', COLOR_SPACES],
    ['-colorize', ' ', [0, 100], ',', [0, 100], ',', [0, 100]],
    ['-colorize', ' ', [0, 100]],
    ['-colors', ' ', [2, 50]],
    ['-contrast',],
    ['-contrast-stretch', ' ', [0.0, 0.5], 'x', [0.0, 0.5], '%'],
    ['-deskew', ' ', [0, 40]],
    ['-despeckle',],
    ['+dither',],
    ['-edge', ' ', [1, 10]],
    ['-emboss', ' ', [1, 5]],
    ['-enhance',],
    ['-equalize',],
    ['-fill', ' ', COLORS, ' -tint ', [0, 100]],
    ['-gamma', ' ', [0.8, 2.3]],
    ['-gamma', ' ', [0.8, 2.3], ',', [0.8, 2.3], ',', [0.8, 2.3]],
    ['-modulate', ' ', [0, 200], ',', [0, 200], ',', [0, 180]],
    ['-monochrome',],
    ['-negate',],
    ['+noise', ' ', NOISE_TYPES, ' -attenuate ', [0.0, 0.7]],
    ['-normalize',],
    ['-posterize', ' ', [1, 4]],
    ['-quantize', ' ', COLOR_SPACES],
    ['-radial-blur', ' ', [0.0, 180.0]],
    ['-raise', ' ', [0, 5]],
    ['-sepia-tone', ' ', [50.0, 99.9]],
    ['-sigmoidal-contrast', ' ', [0.5, 10.0], ',', [30,70], '%'],
    ['+sigmoidal-contrast', ' ', [0.5, 10.0], ',', [30,70], '%'],
    ['-sharpen', ' ', [0, 5]],
    ['-sketch', ' ', [1, 5], 'x', [1, 5]],
    ['-statistic', ' ', STATISTICS, ' ', [0, 5]],
    ['-swirl', ' ', [0, 180]],
    ['-threshold', ' ', [0, 100], '%'],
    ['-vignette', ' 0x', [0, 50]],
];

var COMPOSE_METHODS = [
    'Blend',
    'Dissolve',
    'Modulate',
    'Displace',
    'ChangeMask',
    'Lighten',
    'Lighten_Intensity',
    'Darken',
    'Difference',
    'Multiply',
];


if (require.main === module) main();