#!/bin/sh
# BAIA database backup: pg_dump (custom format) -> gzip -> private S3/R2 bucket,
# then prune old backups (14 daily + 8 weekly). Uses ONLY environment variables.
# Exits non-zero (and prints why) on any failure, so Railway marks the cron run failed.
#
# Required env
#   DATABASE_URL            Postgres connection string. On Railway use the PRIVATE one:
#                           ${{Postgres.DATABASE_URL}} (the cron service runs inside the project).
#   BACKUP_S3_BUCKET        a PRIVATE bucket for backups (NOT the public image bucket)
#   BACKUP_S3_ACCESS_KEY    } token with Object Read & Write on that bucket
#   BACKUP_S3_SECRET_KEY    }
# Optional env
#   BACKUP_S3_ENDPOINT      e.g. https://<account-id>.r2.cloudflarestorage.com (omit for AWS S3)
#   BACKUP_S3_REGION        default "auto" (R2). AWS: e.g. eu-central-1
#   BACKUP_PREFIX           default "backups/"
#   BACKUP_KEEP_DAILY       default 14   (newest N days that have a backup)
#   BACKUP_KEEP_WEEKLY      default 8    (newest N Sundays that have a backup)
#   BACKUP_ALLOW_SHARED_BUCKET=true  allow BACKUP_S3_BUCKET == S3_BUCKET (NOT recommended:
#                           the image bucket is public, so a dump there would be downloadable)
#   BACKUP_DRY_RUN=true     dump + verify, but upload/prune nothing
# For convenience S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_REGION are used when the
# BACKUP_* equivalents are unset (same R2 account, same token if it covers the backup bucket).
#
# Needs: pg_dump, pg_restore, gzip, aws (AWS CLI v2 or v1). See scripts/backup/Dockerfile.
set -eu

log() { printf '%s backup-db: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

: "${DATABASE_URL:?DATABASE_URL is required}"
BUCKET="${BACKUP_S3_BUCKET:-}"
[ -n "$BUCKET" ] || die "BACKUP_S3_BUCKET is required (a private bucket for backups)"
if [ "$BUCKET" = "${S3_BUCKET:-}" ] && [ "${BACKUP_ALLOW_SHARED_BUCKET:-}" != "true" ]; then
  die "BACKUP_S3_BUCKET equals the public image bucket (S3_BUCKET): database dumps would be publicly downloadable. Use a separate private bucket."
fi

ENDPOINT="${BACKUP_S3_ENDPOINT:-${S3_ENDPOINT:-}}"
export AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY:-${S3_ACCESS_KEY:-}}"
export AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY:-${S3_SECRET_KEY:-}}"
export AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-${S3_REGION:-auto}}"
[ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ] || die "BACKUP_S3_ACCESS_KEY / BACKUP_S3_SECRET_KEY are required"
# R2 (and other non-AWS services) reject the AWS CLI's default integrity trailers.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
export AWS_PAGER=""

PREFIX="${BACKUP_PREFIX:-backups/}"
case "$PREFIX" in */) ;; *) PREFIX="$PREFIX/" ;; esac
KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
DRY_RUN="${BACKUP_DRY_RUN:-false}"
case "$KEEP_DAILY$KEEP_WEEKLY" in *[!0-9]*) die "BACKUP_KEEP_DAILY / BACKUP_KEEP_WEEKLY must be whole numbers" ;; esac

aws_s3() { # aws wrapper adding --endpoint-url when set
  if [ -n "$ENDPOINT" ]; then aws --endpoint-url "$ENDPOINT" "$@"; else aws "$@"; fi
}

for tool in pg_dump pg_restore gzip aws; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed"
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="baia-$STAMP.dump.gz"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT INT TERM
FILE="$WORK/$NAME"

# 1) Dump. The password is read from the URL; nothing is printed.
log "dumping database to $NAME"
# Prisma's "?schema=public" parameter is not understood by libpq; drop it, keep the rest (e.g. sslmode).
PG_URL="$(printf '%s' "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"
pg_dump --format=custom --compress=0 --no-owner --no-privileges --dbname="$PG_URL" --file="$WORK/db.dump" \
  || die "pg_dump failed"
gzip -9 -c "$WORK/db.dump" > "$FILE" || die "gzip failed"
rm -f "$WORK/db.dump"
gzip -t "$FILE" || die "backup file is not valid gzip"
SIZE="$(wc -c < "$FILE" | tr -d ' ')"
[ "$SIZE" -gt 1024 ] || die "backup is suspiciously small ($SIZE bytes)"
gzip -dc "$FILE" | pg_restore --list > "$WORK/toc.txt" 2>"$WORK/restore.err" \
  || die "pg_restore cannot read the dump: $(head -c 300 "$WORK/restore.err")"
TABLES="$(grep -c ' TABLE DATA ' "$WORK/toc.txt" || true)"
[ "$TABLES" -gt 0 ] || die "dump contains no table data"
log "dump ok: $SIZE bytes, $TABLES tables"

if [ "$DRY_RUN" = "true" ]; then
  log "BACKUP_DRY_RUN=true: nothing uploaded or pruned"
  exit 0
fi

# 2) Upload and verify the object exists with the same size.
KEY="$PREFIX$NAME"
aws_s3 s3 cp "$FILE" "s3://$BUCKET/$KEY" --only-show-errors || die "upload to s3://$BUCKET/$KEY failed"
REMOTE_SIZE="$(aws_s3 s3api head-object --bucket "$BUCKET" --key "$KEY" --query ContentLength --output text)" \
  || die "could not verify the uploaded object"
[ "$REMOTE_SIZE" = "$SIZE" ] || die "uploaded size $REMOTE_SIZE differs from local size $SIZE"
log "uploaded s3://$BUCKET/$KEY ($REMOTE_SIZE bytes)"

# 3) Prune: keep the newest KEEP_DAILY distinct days and the newest KEEP_WEEKLY Sundays
#    (for each kept day/Sunday the latest backup of that day is kept). Only keys that match
#    our own naming (baia-YYYYMMDDTHHMMSSZ.dump.gz) are ever considered for deletion.
aws_s3 s3api list-objects-v2 --bucket "$BUCKET" --prefix "$PREFIX" --query 'Contents[].Key' --output text \
  | tr '\t' '\n' | grep -E "^${PREFIX}baia-[0-9]{8}T[0-9]{6}Z\.dump\.gz$" | sort -r > "$WORK/keys.txt" \
  || die "could not list existing backups"

DELETE="$(awk -v prefix="$PREFIX" -v kd="$KEEP_DAILY" -v kw="$KEEP_WEEKLY" '
  function dow(y, m, d,   t, k) { # 0 = Sunday (Sakamoto)
    split("0 3 2 5 0 3 5 1 4 6 2 4", t, " ")
    if (m < 3) y -= 1
    return (y + int(y/4) - int(y/100) + int(y/400) + t[m] + d) % 7
  }
  {
    key = $0
    stamp = substr(key, length(prefix) + 6, 8)          # YYYYMMDD
    y = substr(stamp, 1, 4) + 0; m = substr(stamp, 5, 2) + 0; d = substr(stamp, 7, 2) + 0
    n++; keys[n] = key; day[n] = stamp; sunday[n] = (dow(y, m, d) == 0)
  }
  END {
    # keys arrive newest first, so the first key seen for a day is that day'"'"'s latest backup
    for (i = 1; i <= n; i++) {
      if (!(day[i] in seen)) {
        seen[day[i]] = 1; days++
        if (days <= kd) keep[i] = 1
        if (sunday[i]) { sundays++; if (sundays <= kw) keep[i] = 1 }
      }
    }
    for (i = 1; i <= n; i++) if (!keep[i]) print keys[i]
  }' "$WORK/keys.txt")"

PRUNED=0
for old in $DELETE; do
  aws_s3 s3api delete-object --bucket "$BUCKET" --key "$old" >/dev/null || die "could not delete old backup $old"
  PRUNED=$((PRUNED + 1))
done
log "pruned $PRUNED old backup(s); retention: $KEEP_DAILY daily + $KEEP_WEEKLY weekly"
log "done"
