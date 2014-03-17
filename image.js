// Reusable image processing routines, based on ImageMagick
var init = require('./init')
  , im = require('imagemagick')
  , async = require('async')
  , util = require('./util')
  ;

exports.Process = function(in_file, out_file, fx_params, cb) {
  var log = init.log;

  fx_params = fx_params.slice();
  fx_params.splice(0, 0, in_file);
  fx_params.push('-limit');
  fx_params.push('thread');
  fx_params.push('1');
  fx_params.push(out_file);
  var start_time = new Date();
  im.convert(fx_params, function (err, stdout) {
    if (err)
      log.error('ImageMagick convert: error', {
        in_file: in_file,
        out_file: out_file,
        params: fx_params,
        err: err,
        stdout: stdout,
        walltime_sec: (new Date() - start_time) / 1000,
      });
    else
      log.info('ImageMagick convert: finished', {
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
  var log = init.log;

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
      log.error('MultiResize:Imagemagick: error ' + err, util.logsafe({err: err, stdout: stdout}));
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
          op[j] = Math.floor(op[j]*100)/100;
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

exports.GenerateBlendLayer = function() {
  var op = util.choice(COMPOSE_METHODS);
  var cmd = [];
  var args = '';
  if (op == 'Blend' || op == 'Dissolve')
    // Blend and dissolve require a source percent
    args = util.format('%dx%d', util.randint(200), util.randint(100));
  if (op == 'Modulate')
    // Modulate requires brightness and saturation percent
    args = util.format('%dx%d', util.randint(100), util.randint(100));
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
    '-define', 'compose:args=' + args,
    '-composite',
  ]);

  return cmd;
}

// config has optional fields convert_path, identify_path
exports.Init = function(config, cb) {
  var log = init.log;

  if (config.convert_path)
    im.convert.path = config.convert_path;
  if (config.identify_path)
    im.identify.path = config.identify_path;

  async.series([
    _GetNoiseTypes,
    _GetColorspaces,
    _GetStatistics,
    _GetColors,
  ], cb);

  function _trim(str) {
    str = str.replace(/^\s*|\s*$/g, '');
    return str.length ? str : null;
  }

  function _GetNoiseTypes(next) {
    im.convert(['-list', 'noise'], function (err, stdout) {
      if (err) return next(err, stdout);
      var noise_types = stdout.split('\n');
      if (noise_types.length) NOISE_TYPES = noise_types.filter(_trim);
      next();
    });
  }

  function _GetColorspaces(next) {
    im.convert(['-list', 'colorspace'], function (err, stdout) {
      if (err) return next(err, stdout);
      var colorspaces = stdout.split('\n');
      if (colorspaces.length) COLOR_SPACES = colorspaces.filter(_trim);
      next();
    });
  }

  function _GetStatistics(next) {
    im.convert(['-list', 'statistic'], function (err, stdout) {
      if (err) return next(err, stdout);
      var statistics = stdout.split('\n');
      if (statistics.length) STATISTICS = statistics.filter(_trim);
      next();
    });
  }

  function _GetColors(next) {
    im.convert(['-list', 'color'], function (err, stdout) {
      if (err) return next(err, stdout);
      var colors = stdout.split('\n');
      var start = false;
      if (colors.length) {
        COLORS = [];
        for (var i = 0; i < colors.length; i++)
          if (!start) {
            if (colors[i].match(/^\-+\s*$/))
              start = true;
            continue;
          }
          else {
            var col = colors[i].replace(/\s.*/, '');
            COLORS.push(col);
          }
      }
      if (!COLORS.length) return next('Unable to parse predefined color names');
      next();
    });
  }
}

// Tailored to ImageMagick 6.8.8-8
var NOISE_TYPES = ['Gaussian', 'Impulse', 'Poisson', 'Random', 'Uniform'];
var COLOR_SPACES = ['CIELab', 'CMY', 'CMYK', 'Gray', 'HCL', 'HCLp', 'HSB', 'HSI', 'HSL',
                    'HSV', 'HWB', 'Lab', 'LCH', 'LCHab', 'LCHuv', 'LMS', 'Log', 'Luv',
                    'OHTA', 'Rec601Luma', 'Rec601YCbCr', 'Rec709Luma', 'Rec709YCbCr',
                    'RGB', 'scRGB', 'sRGB', 'Transparent', 'XYZ', 'YCbCr', 'YDbDr',
                    'YCC', 'YIQ', 'YPbPr', 'YUV'];
var STATISTICS = ['Maximum', 'Median', 'Mean', 'Minimum', 'Mode', 'Gradient', 'Nonpeak'];
var COLORS = ['RoyalBlue1', 'darkcyan', 'goldenrod', 'firebrick', 'DarkOrange',
              'Navy', 'DarkGreen', 'DodgerBlue', 'Gold'];
var OPERATORS = [
    ['-adaptive-blur', ' ', [1.5, 5.0]],
    ['-adaptive-sharpen', ' ', [1.5, 5.0]],
    ['-auto-gamma',],
    ['-auto-level',],
    ['-black-threshold', ' ', [1, 100], '%'],
    ['-blue-shift', ' ', [1.5, 5.0]],
    ['-blur', ' ', '0x', [1.0, 5.0]],
    ['-blur', ' ', '0x', [1.0, 5.0], ' -paint ', [1, 5]],
    ['-blur', ' ', '0x3 -negate', ' -edge ', [1, 5], ' -negate'],
    ['-brightness-contrast', ' ', [-50, 50], 'x', [-50, 50], '%'],
    ['-charcoal', ' ', [1, 15]],
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
    ['-flip'],
    ['-gamma', ' ', [0.8, 2.3]],
    ['-gamma', ' ', [0.8, 2.3], ',', [0.8, 2.3], ',', [0.8, 2.3]],
    ['-implode', ' ', [1, 8]],
    ['-lat', ' ', [0, 10]],
    ['-level', ' ', [0,200], ',', [0,200], ',', [-0.5, 0.5]],
    ['-modulate', ' ', [0, 200], ',', [0, 200], ',', [0, 180]],
    ['-monochrome',],
    ['-negate',],
    ['+noise', ' ', NOISE_TYPES, ' -attenuate ', [0.0, 0.7]],
    ['-normalize',],
    ['-paint', ' ', [1, 10]],
    ['-posterize', ' ', [1, 4]],
    ['-quantize', ' ', COLOR_SPACES],
    ['-radial-blur', ' ', [0.0, 180.0]],
    ['-raise', ' ', [0, 5]],
    ['-sepia-tone', ' ', [50.0, 99.9]],
    ['-sigmoidal-contrast', ' ', [0.5, 10.0], ',', [30,70], '%'],
    ['+sigmoidal-contrast', ' ', [0.5, 10.0], ',', [30,70], '%'],
    ['-shade', ' ', [0,359], 'x', [0,359]],
    ['-sharpen', ' ', [0, 5]],
    ['-sketch', ' ', [1, 5], 'x', [1, 5]],
    ['-statistic', ' ', STATISTICS, ' ', [0, 5]],
    ['-swirl', ' ', [0, 359]],
    ['-threshold', ' ', [0, 100], '%'],
];
var COMPOSE_METHODS = [
    'Blend',
    'Dissolve',
    'Modulate',
    'Displace',
    'ChangeMask',
    'Lighten',
    'Darken',
    'Difference',
    'Multiply',
    'Darken',
    'PegtopLight',
    'Saturate',
    'VividLight',
    'HardLight',
    'ColorBurn',
    'Luminize',
    'PinLight',
    'SoftLight',
    'Difference',
];

if (require.main === module) {
  exports.Init({
    convert_path: 'bin/convert',
    identify_path: 'bin/identify',
  }, function(err, stdout) {
    if (err) return console.error('ImageMagick Error', err, stdout);
    console.log('COLORS', COLORS);
    console.log('NOISE_TYPES', NOISE_TYPES);
    console.log('COLOR_SPACES', COLOR_SPACES);
    console.log('STATISTICS', STATISTICS);
  });
}
