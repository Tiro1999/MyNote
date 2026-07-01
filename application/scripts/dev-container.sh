#!/usr/bin/env sh

set -eu

exec dbus-run-session -- sh -lc '
  export GSETTINGS_BACKEND=memory
  exec ./node_modules/.bin/electron-vite dev -- \
    --no-sandbox \
    --disable-gpu \
    --password-store=basic \
    --disable-features=MediaRouter
'
