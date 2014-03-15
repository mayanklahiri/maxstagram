#!/bin/bash -e
# 
# A script to download the latest version of ImageMagick, 
# build a static binary with minimal options, and dump
# the 'convert' and 'identify' utilities in the bin/
# subdirectory.
#
# Requires:
# -- wget
# -- libjpeg
# -- zlib
# -- g++ toolchain
#
pushd /tmp
rm -rf ImageMagick* convert identify
wget http://www.imagemagick.org/download/ImageMagick.tar.gz
tar xzvf ImageMagick.tar.gz
cd ImageMagick-*
./configure \
  --prefix=`pwd` \
  --with-quantum-depth=8 \
  --with-package-release-name=MaxstagramBuild \
  --enable-shared=no \
  --enable-static=yes \
  --enable-hdri \
  --with-autotrace=no \
  --with-djvu=no \
  --with-dps=no \
  --with-fpx=no \
  --with-fontconfig=no \
  --with-freetype=no \
  --with-gslib=no \
  --with-gvc=no \
  --with-jbig=no \
  --with-jpeg=yes \
  --with-jp2=yes \
  --without-magick-plus-plus \
  --with-openexr=no \
  --with-perl=no \
  --with-png=no \
  --with-rsvg=no \
  --with-tiff=no \
  --with-wmf=no \
  --with-x=no \
  --with-xml=no \
  --with-zlib=yes \
  --with-webp=no \
  CXXFLAGS="-O3 -Wall -W -pthread -strip" \
  LDFLAGS="-static"
make
make install
cp utilities/convert /tmp
cp utilities/identify /tmp
popd
mkdir -p bin
mv /tmp/convert bin
mv /tmp/identify bin
rm -rf /tmp/ImageMagick*
echo All done.
