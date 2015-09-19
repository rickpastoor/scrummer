#!/bin/bash
#
# This script assumes a linux environment

echo "*** uMatrix.firefox: Copying files"

DES=dist/build/scrummer.firefox
rm -rf $DES
mkdir -p $DES
mkdir -p $DES/data

cp -R src/*                             $DES/data
cp    platform/firefox/index.js         $DES/
cp    platform/firefox/package.json     $DES/
cp -R platform/chromium/img             $DES/
mv    $DES/img/icon128.png              $DES/icon.png

if [ "$1" = all ]; then
    echo "*** scrummer.firefox: Creating package..."
    pushd $DES/
    jpm xpi
    mv ./@scrummer-*.xpi ./scrummer.firefox.xpi
    popd
fi

echo "*** scrummer.firefox: Package done."
