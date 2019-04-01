#!/usr/bin/env bash

set -eu

BASE_DIR="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
EXTENSION_DIR="$BASE_DIR/extension"
TMP_DIR=$(mktemp -d)
DEST="${TMP_DIR}/pioneer-enrollment-study"
mkdir -p $DEST

# deletes the temp directory
function cleanup {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

while read -r LINE || [[ -n "${LINE}" ]]; do
  mkdir -p "$(dirname "${DEST}/${LINE}")"
  cp -r "${EXTENSION_DIR}/${LINE}" "$(dirname "${DEST}/${LINE}")"
done < "${EXTENSION_DIR}/build-includes.txt"

pushd $DEST
zip -r pioneer-enrollment-study.xpi *
mv pioneer-enrollment-study.xpi $BASE_DIR
popd
