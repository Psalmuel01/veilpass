#!/bin/sh
set -eu
umask 077
# Render mounts its disk at runtime. Change only our application subdirectory,
# not the volume root or any unrelated paths. Run the application unprivileged.
if [ "${VEILPASS_STORAGE:-}" != "postgres" ]; then
  mkdir -p /var/data/veilpass
  chown node:node /var/data/veilpass
  chmod 700 /var/data/veilpass
fi
exec gosu node "$@"
