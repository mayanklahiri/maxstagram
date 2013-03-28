# Copyright 2013 Mayank Lahiri
# mlahiri@gmail.com
# Released under the BSD License
"""Generates a random ImageMagick operator.

   Chaining the result of successive invocations of GenOperator() will result
   in a random image filter. The constants and ranges for numeric parameters
   are chosen to be a good balance between aesthetics and computational
   heaviness. Nonetheless, some combinations of operations and parameter
   values can be very CPU-intensive.
"""
from random import choice
from random import uniform

NOISE_TYPES = ('Gaussian', 'Laplacian', 'Multiplicative', 'Poisson', 'Impulse')
COLOR_SPACES = ('XYZ', 'Gray', 'HWB', 'Log', 'YUV', 'HSB', 'Rec709Luma', 'YIQ',
                'Lab', 'YCC', 'HSL', 'CMYK', 'OHTA', 'YCbCr', 'CMY')
STATISTICS = ('Maximum', 'Median', 'Mean', 'Mode', 'Gradient', 'Nonpeak')
COLORS = ('RoyalBlue1', 'darkcyan', 'goldenrod', 'firebrick', 'DarkOrange',
          'Navy', 'DarkGreen', 'DodgerBlue', 'Gold')
OPERATORS = (
    ('-adaptive-blur', ' ', (1.5, 5.0)),
    ('-adaptive-sharpen', ' ', (1.5, 5.0)),
    ('-auto-gamma',),
    ('-auto-level',),
    ('-blue-shift', ' ', (1.5, 5.0)),
    ('-blur', ' ', '0x', (1.0, 5.0)),
    ('-blur', ' ', '0x', (1.0, 5.0), ' -paint ', (1, 5)),
    ('-blur', ' ', '0x3 -negate', ' -edge ', (1, 5), ' -negate'),
    ('-brightness-contrast', ' ', (-50, 50), 'x', (-50, 50), '%'),
    ('-charcoal', ' ', (1, 10)),
    ('-colorspace', ' ', COLOR_SPACES),
    ('-colorize', ' ', (0, 100)),
    ('-colorize', ' ', (0, 100), ',', (0, 100), ',', (0, 100)),
    ('-colors', ' ', (2, 50)),
    ('-contrast',),
    ('-contrast-stretch', ' ', (0.0, 0.5), 'x', (0.0, 0.5), '%'),
    ('-deskew', ' ', (0, 40)),
    ('-despeckle',),
    ('+dither',),
    ('-edge', ' ', (1, 10)),
    ('-emboss', ' ', (1, 5)),
    ('-enhance',),
    ('-equalize',),
    ('-fill', ' ', COLORS, ' -tint ', (0, 100)),
    ('-gamma', ' ', (0.8, 2.3)),
    ('-gamma', ' ', (0.8, 2.3), ',', (0.8, 2.3), ',', (0.8, 2.3)),
    ('-modulate', ' ', (0, 200), ',', (0, 200), ',', (0, 180)),
    ('-monochrome',),
    ('-negate',),
    ('+noise', ' ', NOISE_TYPES, ' -attenuate ', (0.0, 0.7)),
    ('-normalize',),
    ('-posterize', ' ', (1, 4)),
    ('-quantize', ' ', COLOR_SPACES),
    ('-radial-blur', ' ', (0.0, 180.0)),
    ('-raise', ' ', (0, 5)),
    ('-sepia-tone', ' ', (50.0, 99.9)),
    ('-sigmoidal-contrast', ' ', (0.5, 10.0), ',', (30,70), '%'),
    ('+sigmoidal-contrast', ' ', (0.5, 10.0), ',', (30,70), '%'),
    ('-sharpen', ' ', (0, 5)),
    ('-sketch', ' ', (1, 5), 'x', (1, 5)),
    ('-statistic', ' ', STATISTICS, ' ', (0, 5)),
    ('-swirl', ' ', (0, 180)), 
    ('-threshold', ' ', (0, 100), '%'), 
    ('-vignette', ' 0x', (0, 50)),
)
COMPOSE_METHODS = (
    'Blend',
    'Dissolve',
    'Modulate',
    'Displace',
    'ChangeMask',
)


def GenOperator():
  """Generates a random ImageMagick filtering operator."""
  op = choice(OPERATORS)
  def _MakeChoice(param):
    if isinstance(param, tuple):
      if isinstance(param[0], str):
        param = choice(param)
      elif isinstance(param[0], float):
        param = round(uniform(param[0], param[1]), 2)
      elif isinstance(param[0], int):
        param = int(uniform(param[0], param[1]))
    return param
  return map(_MakeChoice, op)

def GenBlend():
  """Generates a random ImageMagick blending operator."""
  op = choice(COMPOSE_METHODS)
  args = ''
  if op == 'Blend' or op == 'Dissolve':
    # Blend and dissolve require a source percent 
    args = str(int(uniform(0, 200)))
  if op == 'Modulate':
    # Modulate requires brightness and saturation percent
    args = str(int(uniform(0, 200))) + 'x' + str(int(uniform(0, 200)))
  if op == 'Displace':
    # Displace requires an X-scale and Y-scale expressed as a percentage
    args = str(int(uniform(0, 100))) + 'x' + str(int(uniform(0, 100))) + '%'
  if op == 'ChangeMask':
    # ChangeMask requires a fuzz factor to be set before composite is called
    op = op + ' -fuzz ' + str(int(uniform(0, 100))) + '%'

  return ' '.join((
    '-compose',
    op,
    '-define compose:args=' + args,
    '-composite',
    '-auto-level',    
  ))


if __name__ == '__main__':
  print ''.join(map(str, GenOperator()))
