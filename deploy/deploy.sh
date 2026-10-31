#!/usr/bin/env bash
# Updates the server to the latest main. Any failure stops here, before the running apps restart.
set -euo pipefail

# Inside a function, because git can replace this file while it runs.
main() {
  cd "$(dirname "$(readlink -f "$0")")/.."

  git fetch --quiet origin main
  git merge --ff-only origin/main

  pnpm install --frozen-lockfile
  NEXT_PUBLIC_API_URL=/v1 pnpm build
  pnpm --filter @fynlo/server db:migrate

  pm2 startOrReload deploy/ecosystem.config.cjs --update-env
  pm2 save

  for _ in $(seq 1 30); do
    if curl --fail --silent --output /dev/null http://127.0.0.1:4000/v1/health/ready &&
      curl --fail --silent --output /dev/null http://127.0.0.1:3000/login; then
      echo "Deployed $(git rev-parse --short HEAD)"
      return 0
    fi
    sleep 2
  done

  echo "The apps didn't become healthy. Check: pm2 logs" >&2
  return 1
}

main "$@"
