Maxstagram
==========

Maxstagram is a small Python program that uses the open-source ImageMagick
library to automatically generate photo filters. It does this by randomly
generating a sequence of image manipulations from a chosen range which
ocassionally results in tasteful results. Most of the generated filters
will look awful and could cause severe trauma both physically and mentally
to some individuals, but usually at least a few in any run are eye-popping.

You can try it out at [Maxstagram.com](http://maxstagram.com).

![ScreenShot](http://maxstagram.com/featured/featured-17.jpg)
![ScreenShot](http://maxstagram.com/featured/featured-2.jpg)
![ScreenShot](http://maxstagram.com/featured/featured-11.jpg)
![ScreenShot](http://maxstagram.com/featured/featured-5.jpg)

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

Laptop Warning
--------------

ImageMagick tends to max out your CPU with multiple threads. This makes it
fast, but might also cause your laptop to burn up and/or explode into flames
when you're generating random filters. It might be more prudent to run it
on a desktop with an OpenCL-enabled GPU, with a fan running, in the winter.
