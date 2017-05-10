#!/bin/bash
#
# This script assumes a linux environment

source ./config

echo "*** scrummer(Firefox-WebExt): Creating package"
echo "*** scrummer(Firefox-WebExt): Copying files"

DES=./dist/build/scrummer.firefox-webext
rm -rf $DES
mkdir -p $DES
mkdir -p $DES/img/

cp -R ./src/*                           $DES/
cp -R ./platform/firefox-webext/img/*         $DES/img/
cp    ./platform/firefox-webext/manifest.json $DES/

# Replace version
sed -i.bak 's/SCRUMMER_VERSION/'$SCRUMMER_VERSION'/g' $DES/manifest.json
rm $DES/manifest.json.bak

# Replace chrome.storage by browser.storage
sed -i.bak 's/chrome\.storage/browser\.storage/g' $DES/scrummer.js
sed -i.bak 's/chrome\.storage/browser\.storage/g' $DES/settings.js
rm $DES/scrummer.js.bak
rm $DES/settings.js.bak

if [ "$1" = all ]; then
    echo "*** scrummer.firefox-webext: Creating package..."
    pushd $DES
    zip scrummer.firefox-webext.zip -qr *
    mv scrummer.firefox-webext.zip ..
    popd
fi

echo "*** scrummer(Firefox-WebExt): Package done."
