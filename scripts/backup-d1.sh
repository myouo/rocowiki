#!/usr/bin/env bash
set -euo pipefail
# Requires an independently managed age public recipient and external retention/storage.
if [[ $# != 3 ]]; then echo 'Usage: scripts/backup-d1.sh <wrangler-environment> <age-public-recipient> <encrypted-output.age>' >&2; exit 2; fi
command -v age >/dev/null
task_backup=$(mktemp -d)
trap 'rm -rf "$task_backup"' EXIT
umask 077
(cd apps/api && npx --no-install wrangler d1 export rocowiki-production --env "$1" --remote --output "$task_backup/database.sql")
age --recipient "$2" --output "$3" "$task_backup/database.sql"
echo 'Encrypted backup created. Copy it to independent storage and verify restoration.'
