# syntax=docker/dockerfile:1
# Railway Cron service image for scripts/backup-db.sh.
# Build context: repository root.   docker build -f scripts/backup/Dockerfile .
# PG_VERSION must be >= the Postgres server's major version (pg_dump refuses to dump a newer server).
ARG PG_VERSION=17
FROM postgres:${PG_VERSION}-alpine
RUN apk add --no-cache aws-cli
COPY scripts/backup-db.sh /usr/local/bin/backup-db.sh
RUN chmod +x /usr/local/bin/backup-db.sh
# The base image's entrypoint starts a Postgres server; this image only runs the backup and exits.
ENTRYPOINT []
USER postgres
CMD ["/usr/local/bin/backup-db.sh"]
