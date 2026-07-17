#!/usr/bin/env bash
set -Eeuo pipefail

# This resets only the PostgreSQL/pgvector volume. MongoDB is external and uploads are preserved.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "${1:-}" != "--yes" ]]; then
  echo "WARNING: this removes the PostgreSQL/pgvector data volume."
  echo "MongoDB and uploaded files will be preserved."
  read -r -p "Type RESEED to continue: " confirmation
  [[ "$confirmation" == "RESEED" ]] || { echo "Cancelled."; exit 1; }
fi

postgres_container="$(docker compose ps -aq postgres | head -n 1)"
postgres_volume=""
if [[ -n "$postgres_container" ]]; then
  postgres_volume="$(docker inspect "$postgres_container" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')"
fi

docker compose stop postgres ml backend parser places-sync
docker compose rm -sf postgres

if [[ -z "$postgres_volume" ]]; then
  echo "Could not identify the pgdata volume from the Postgres container." >&2
  exit 1
fi
docker volume rm "$postgres_volume"

docker compose up -d --build

echo "Stack started. Follow the fresh parse with:"
echo "  docker compose logs -f parser"
