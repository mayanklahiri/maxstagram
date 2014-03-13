// Reusable image processing routines, based on ImageMagick
var im = require('imagemagick')
  , async = require('async')
  , util = require('./util')
  ;

exports.Process = function(in_file, out_file, fx_params, cb) {
  fx_params.splice(0, 0, in_file);
  fx_params.push(out_file);
  var start_time = new Date();
  im.convert(fx_params, function (err, stdout) {
    if (err)
      util.log.error('Process: ' + stdout, {
        in_file: in_file,
        out_file: out_file,
        params: fx_params,
        err: err,
        walltime_sec: (new Date() - start_time) / 1000,
      });
    else
      util.log.info('Process: finished', {
        in_file: in_file,
        out_file: out_file,
        params: fx_params,
        stdout: stdout,
        walltime_sec: (new Date() - start_time) / 1000,
      });
    cb(err, stdout);
  });
}

exports.MultiResize = function(in_file, out_file_base, sizes, quality, cb) {
  if (!in_file) throw new Error('MultiResize: in_file is null');
  if (!out_file_base) throw new Error('MultiResize: out_file_base is null');
  if (!sizes) throw new Error('MultiResize: sizes is null');
  if (!cb) throw new Error('MultiResize: cb is null');

  // Assemble asynchronous series circuit
  var exec_sequence = [];
  var output_files = [];
  for (var dim_label in sizes)
    exec_sequence.push((function(dim_label, max_dim) {
      return function(next) {
        // Downsize image, treating the special case label "square" differently.
        var out_file = util.format('%s-%s.jpg', out_file_base, dim_label);
        output_files.push(out_file);
        var params = [
          in_file,
          '-auto-level',
          '-auto-orient',
        ];
        if (dim_label == 'square')
          params.push.apply(params, [
            '-thumbnail', util.format('%dx%d^', max_dim, max_dim),
            '-gravity', 'center',
            '-extent', util.format('%dx%d', max_dim, max_dim),
          ]);
        else
          params.push.apply(params, [
            '-resize', util.format('%dx%d>', max_dim, max_dim),
          ]);
        params.push.apply(params, [
          '-quality', quality,
          '-density', '200',
          '-strip',
          out_file,
        ]);

        // Invoke Imagemagick
        im.convert(params, next);
      };
    })(dim_label, sizes[dim_label]));

  // Terminal node in the series circuit
  function _terminal(err, stdout) {
    if (err) {
      util.log.error('MultiResize:Imagemagick: error ' + err,
                     {err: err, stdout: stdout});
      return cb(err, stdout);
    }
    return cb(null, output_files);
  }

  // Execute
  return async.series(exec_sequence, _terminal);
}


exports.GenerateEffectsLayer = function(num_operators) {
  var cmd = [];
  for (var i = num_operators; --i>=0; ) {
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
  return cmd;
}

exports.GenerateBlendLayer = function(fx_file) {
  var op = util.choice(COMPOSE_METHODS);
  var cmd = [fx_file];
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

