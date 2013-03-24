Maxstagram
==========

Maxstagram is a small Python program that uses the open-source ImageMagick
library to automatically generate photo filters. It does this by randomly
generating a sequence of image manipulations from a tastefully chosen
range. Most of the generated filters will look awful, but usually at least
a few in any run are eye-popping.

![ScreenShot](http://maxstagram.com/featured/featured-3.jpg)
![ScreenShot](http://maxstagram.com/featured/featured-2.jpg)

Maxstagram was written for a Linux system. It will probably work on Windows
with ImageMagick installed if some hard-coded path conventions are tweaked.

Usage
-----

    ./GenerateFilters.py photo1.jpg photo900.jpg another-photo.jpg

This will generate 100 random filters, run all the photos you specified
on the command line through them, and output the results to a new
subdirectory called "output" below the working directory. There will
be a nice index.html page in that directory that you can open in a
browser to quickly scan the results.
