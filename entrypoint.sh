#!/bin/sh
chown -R node:node /usr/src/app
su node
exec "$@"