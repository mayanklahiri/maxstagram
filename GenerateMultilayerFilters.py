#!/usr/bin/env python
# Copyright 2013 Mayank Lahiri
# mlahiri@gmail.com
# Released under the BSD License
"""Generates a series of random photo filters and processes 
   a set of photos with them, generating nice output in output/index.html.
   This is the *multi-layer* variant of GenerateFilters.py -- it is much
   more prone to generating absolute garbage since the space of filters
   is much larger. Use this script at your own risk; your eyes may bleed.
"""
from random import uniform
from sys import argv
from gen_operator import GenOperator, GenLayeredOperator, GenBlend
from image_processor import ProcessImage
from runner import Run, GetTimer, ResetTimer
from html_index_writer import StartHTML, WriteHTML, EndHTML
import os


def main(argv):
  if len(argv) < 1:
    print 'Usage: GenerateFilters.py <one or more image files>'
    exit(1)

  # Check for ImageMagick in the path
  if 0 != Run('convert'):
    print 'ImageMagick\'s "convert" does not seem to be in your path.'
    print 'In Debian/Ubuntu, type: sudo apt-get install imagemagick'
    exit(1)

  # Create output directory and empty it out
  try:
    if not os.path.exists('output'):
      os.mkdir('output')
    if not os.path.isdir('output'):
      print 'You already have a file called "output" in the current directory.'
      print 'Delete it. Now.'
      exit(1)
    for fname in os.listdir('output'):
      os.remove('output/' + fname)
  except:
    print 'Could not empty out the "output" directory. Do it yourself.'
    exit(1)

  # Generate resized square source images from files specified on command line
  # Use lossless PNG as the intermediate file format
  originals = []
  for infile in argv:
    outfile = 'output/orig-' + os.path.basename(infile).replace(' ', '_') + '.jpg'
    if 0 != Run(('convert',
                 '"' + infile + '"',
                 '-auto-level',
                 '-auto-orient',
                 '-thumbnail 640x640^',
                 '-gravity center',
                 '-extent 640x640',
                 '-quality 98',
                 outfile)):
      print 'Cannot resize', infile, 'to save to', outfile
      exit(1)
    print 'INPUT:', infile, '=>', outfile
    originals.append(outfile)

  # Generate filters
  StartHTML('output/index.html')
  for filter_idx in range(0, 400):
    # Increasing the number of operators allows for more complex filters at
    # the cost of increased computational requirements.
    num_layers = int(uniform(1, 3))
    filterop = GenLayeredOperator(num_layers)
    blendop = GenBlend()
    print '''
=================================================================
FILTER: {filterop}
BLEND:  {blendop}
=================================================================
'''.format(**locals())
    
    # Process each input file with the filter
    ResetTimer()
    def runner(fn): return ProcessImage(fn, 'output/', filterop, blendop, filter_idx, 640)
    outputs = [ runner(i) for i in originals ]
    if None in outputs:
      print "ERROR: please inspect /tmp/IM.out and /tmp/IM.err"
      exit(1)    

    # Write HTML table row
    avg_time = round(GetTimer() / len(originals), 2)
    WriteHTML(filter_idx, filterop, blendop, outputs, avg_time)
  EndHTML()


if __name__ == '__main__':
  main(argv[1:])
