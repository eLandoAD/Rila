#!/bin/bash
# SecureVault backup: dump del database + tar dello storage cifrato.
# Copiare sul VPS in /root/securevault/backup.sh (chmod +x) e mettere in cron:
#   30 3 * * * /root/securevault/backup.sh >> /root/backups/backup.log 2>&1
#
# I blob restano cifrati anche nel backup: il server non ha le chiavi, quindi
# nemmeno chi ha in mano questo tar puo' leggere i file. Il dump del database
# invece contiene hash delle password e chiavi wrappate: tienilo privato.
set -euo pipefail

DEST=${BACKUP_DEST:-/root/backups}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-7}
DB_CONTAINER=${DB_CONTAINER:-securevault_postgres}
BACKEND_CONTAINER=${BACKEND_CONTAINER:-rila-backend}
STAMP=$(date +%F_%H%M)

mkdir -p "$DEST"

# --- database ---------------------------------------------------------------
# pipefail e' attivo: se pg_dump muore, il file .gz non resta buono per sbaglio
docker exec "$DB_CONTAINER" \
  pg_dump -U postgres -d securevault_db \
  | gzip > "$DEST/db_$STAMP.sql.gz"

# --- blob cifrati -----------------------------------------------------------
# Il nome del volume lo prefissa compose con quello della directory
# (securevault_securevault_storage, non securevault_storage): invece di
# indovinarlo, lo si chiede al container che lo monta. Sbagliare nome non da'
# errore - docker ne creerebbe uno nuovo vuoto e il tar uscirebbe di 45 byte.
STORAGE_VOLUME=$(docker inspect -f \
  '{{range .Mounts}}{{if eq .Destination "/storage"}}{{.Name}}{{end}}{{end}}' \
  "$BACKEND_CONTAINER")

if [ -z "$STORAGE_VOLUME" ]; then
  echo "ERRORE: nessun volume montato su /storage in $BACKEND_CONTAINER" >&2
  exit 1
fi

docker run --rm \
  -v "$STORAGE_VOLUME":/data:ro \
  -v "$DEST":/backup \
  alpine tar czf "/backup/storage_$STAMP.tar.gz" -C /data .

# un tar di un volume vuoto pesa una manciata di byte: meglio accorgersene qui
STORAGE_SIZE=$(stat -c %s "$DEST/storage_$STAMP.tar.gz")
if [ "$STORAGE_SIZE" -lt 1024 ]; then
  echo "ATTENZIONE: storage_$STAMP.tar.gz e' di $STORAGE_SIZE byte" \
       "(volume $STORAGE_VOLUME vuoto?)" >&2
fi

# --- retention --------------------------------------------------------------
find "$DEST" -name 'db_*.sql.gz'      -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'storage_*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "ok: $DEST/db_$STAMP.sql.gz  $DEST/storage_$STAMP.tar.gz ($STORAGE_SIZE byte)"
