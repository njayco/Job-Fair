#!/bin/bash
set -e

# Install root + workspace dependencies (non-interactive)
npm install --no-audit --no-fund --silent
(cd client && npm install --no-audit --no-fund --silent)
(cd server && npm install --no-audit --no-fund --silent)

# Rebuild the React client so Express serves the latest bundle on next restart
(cd client && npm run build)
