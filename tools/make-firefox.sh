#!/bin/bash
#
# This script assumes a linux environment

source ./config

echo "*** scrummer.firefox: Copying files"

DES=dist/build/scrummer.firefox
rm -rf $DES
mkdir -p $DES
mkdir -p $DES/data

cp -R src/*                             $DES/data
cp    platform/firefox/index.js         $DES/
cp    platform/firefox/package.json     $DES/
cp -R platform/chromium/img             $DES/
mv    $DES/img/icon128.png              $DES/icon.png

# Replace version
sed -i.bak 's/SCRUMMER_VERSION/'$SCRUMMER_VERSION'/g' $DES/package.json
rm $DES/package.json.bak

if [ "$1" = all ]; then
    echo "*** scrummer.firefox: Creating package..."
    pushd $DES/
    jpm xpi
    mv ./scrummer.xpi ./../scrummer.firefox.xpi
fi

echo "*** scrummer.firefox: Package done."
