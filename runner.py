# Copyright 2013 Mayank Lahiri
# mlahiri@gmail.com
# Released under the BSD License
"""Run an (ImageMagick) shell command with timing information."""
from time import time
from subprocess import call

global_wall_time = 0

def Run(cmd): 
  '''Run a shell command, returning program exit code'''
  global global_wall_time
  start = time()
  if isinstance(cmd, tuple):
    cmd = ' '.join(map(str, cmd))
  rc = call(cmd + '> /tmp/IM.out 2> /tmp/IM.err', shell=True)
  global_wall_time += time() - start 
  return rc

def ResetTimer():
  global global_wall_time
  global_wall_time = 0

def GetTimer():
  global global_wall_time
  return global_wall_time