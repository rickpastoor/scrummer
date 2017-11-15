#!/bin/bash
#
# This script assumes a linux environment

source ./config

echo "*** scrummer.firefox: Copying files"

DES=./dist/build/scrummer.firefox
rm -rf $DES
mkdir -p $DES
mkdir -p $DES/img/

cp -R ./src/*                             $DES/
cp -R ./platform/chromium/img/*           $DES/img
cp    ./platform/firefox/manifest.json    $DES/

# Replace version
sed -i.bak 's/SCRUMMER_VERSION/'$SCRUMMER_VERSION'/g' $DES/manifest.json
rm $DES/manifest.json.bak

if [ "$1" = all ]; then
    echo "*** scrummer.firefox: Creating package..."
    cd $DES
    zip ../scrummer.firefox.zip -qr ./*
fi

echo "*** scrummer.firefox: Package done."
