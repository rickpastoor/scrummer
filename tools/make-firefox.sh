#!/bin/bash
#
# This script assumes a linux environment

source ./config

echo "*** scrummer.firefox: Creating package"
echo "*** scrummer.firefox: Copying files"

DES=./dist/build/scrummer.firefox
rm -rf $DES
mkdir -p $DES
mkdir -p $DES/img/

cp -R ./src/*                           $DES/
cp -R ./platform/firefox/img/*         $DES/img/
cp    ./platform/firefox/manifest.json $DES/

# Replace version
sed -i.bak 's/SCRUMMER_VERSION/'$SCRUMMER_VERSION'/g' $DES/manifest.json
rm $DES/manifest.json.bak

# Replace chrome.storage by browser.storage
sed -i.bak 's/chrome\.storage/browser\.storage/g' $DES/scrummer.js
sed -i.bak 's/chrome\.storage/browser\.storage/g' $DES/settings.js
rm $DES/scrummer.js.bak
rm $DES/settings.js.bak

if [ "$1" = all ]; then
    echo "*** scrummer.firefox: Creating package..."
    pushd $DES
    zip scrummer.firefox.zip -qr *
    mv scrummer.firefox.zip ..
    popd
fi

echo "*** scrummer.firefox: Package done."
