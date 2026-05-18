#!/usr/bin/env bash
# pg-query.sh — psql wrappers used by the smoke harness.
#
# Public:
#   pg_ping <dsn>
#   pg_scalar <dsn> <sql>            # echoes first column of first row
#   pg_count <dsn> <sql>             # echoes integer
#   pg_table_exists <dsn> <table>

set -eu

pg_ping() {
  local dsn="$1"
  if ! command -v psql >/dev/null 2>&1; then
    printf 'SMOKE-FAIL:psql-missing\n' >&2
    return 1
  fi
  if ! psql "$dsn" -tAc 'SELECT 1' >/dev/null 2>&1; then
    printf 'SMOKE-FAIL:pg-unreachable\n' >&2
    return 1
  fi
}

pg_scalar() {
  local dsn="$1" sql="$2"
  psql "$dsn" -tAc "$sql" 2>/dev/null | head -n1 | tr -d '[:space:]'
}

pg_count() {
  local dsn="$1" sql="$2"
  local v
  v=$(pg_scalar "$dsn" "$sql")
  [ -z "$v" ] && v=0
  printf '%s\n' "$v"
}

pg_table_exists() {
  local dsn="$1" tbl="$2"
  local got
  got=$(pg_scalar "$dsn" "SELECT to_regclass('public.${tbl}')")
  if [ -z "$got" ] || [ "$got" = "" ]; then
    printf 'SMOKE-FAIL:pg-table-missing table=%s\n' "$tbl" >&2
    return 1
  fi
}

export -f pg_ping pg_scalar pg_count pg_table_exists
