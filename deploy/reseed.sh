#!/usr/bin/env bash
set -Eeuo pipefail

# This intentionally deletes all Compose volumes: PostgreSQL knowledge-base data, Mongo data,
# and uploaded files. The parser then starts against empty databases and runs its startup crawl.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "${1:-}" != "--yes" ]]; then
  echo "WARNING: this removes all Docker Compose volumes and uploaded files."
  read -r -p "Type RESEED to continue: " confirmation
  [[ "$confirmation" == "RESEED" ]] || { echo "Cancelled."; exit 1; }
fi

docker compose down --volumes --remove-orphans
docker compose up -d --build

echo "Stack started. Follow the fresh parse with:"
echo "  docker compose logs -f parser"
