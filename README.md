## Maxstagram uses randomness to generate image filters.

Throughtout its humble career, Maxstagram has garnered almost five dozen unique views.
Most of these were people looking directly at Maxstagram-filtered images, with 80% of
them having tried to upload an image themselves. That's 8 out of 10 people. It has been
used to generate several thousand filtered images, making it one of the largest and least
consequential collections of modern art.

Maxstagram works using a simple principle: if you put something good into, you might
get something good out of it, eventually. Making an algorithm render garbage is a very
difficult task. There is no obvious way to turn digital coin flips into an aesthetically
pleasing distortion of color and texture, so we rely on the human eye to pick out aesthetic
from randomness. The best we can do is say that every image generated is almost certainly
unique, and generate a lot of them for you to look at reasonably quickly, so that you can
pick out the ones that best appeal to you.

Its inner workings resemble highly trained chaos monkeys working Photoshop, after a human
has taken a nice photograph and loaded it into the program. These monkey may adjust the color
and brightness, apply distortion filters, and flip around the colorspace randomly. Got
a lovely picture of your puppy? It may end up looking like a disembodied eyeball surrounded
in rainbow hues. As for that nice selfie? Your friends will certainly appreciate the uniqueness
of a sepia-toned X-ray filter on it. These are just some of the many, occassionally pleasant,
surprises produced by our Brownian simians.

Maxstagram works conveniently at fine art resolutions, for the modest price of free. The
image files generated can be printed onto large canvases, or as small tattoos.

The free web service is at http://maxstagram.com

## Installation

Linux:

1. Clone this repository.
2. Run `npm install` in the repo root to install package dependencies.
3. Sign up for a free Mailgun account at http://mailgun.com and paste the API key into a file in the repo root called MAILGUN_KEY. This file is ignored by .gitignore.
4. Install MongoDB.
5. Take a look at `config.js` and make changes if you need to.
6. Run `npm run dev` to start the server in development mode, or `npm run prod` for production.
