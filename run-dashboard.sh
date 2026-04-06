#!/usr/bin/env bash
set -e

# Build the dashboard if binary doesn't exist or source is newer
if [ ! -f career-ops-dashboard ] || [ dashboard/main.go -nt career-ops-dashboard ]; then
  echo "Building Career-Ops Dashboard..."
  cd dashboard && go build -o ../career-ops-dashboard . && cd ..
fi

# Run the dashboard
./career-ops-dashboard --path .
