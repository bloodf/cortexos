#!/usr/bin/env bats
# Tests for scripts/os-detect.sh — family + version + subfamily emission.
#
# Run: `bats scripts/__tests__/os-detect.bats`
# If bats is unavailable locally, CI installs it (see distro-matrix.yml).
#
# Fixtures are written into BATS_TMPDIR and selected via `OSRELEASE=<path>`.

setup() {
  SCRIPT="${BATS_TEST_DIRNAME}/../os-detect.sh"
  [ -x "$SCRIPT" ] || chmod +x "$SCRIPT"
  FIX="$BATS_TMPDIR/os-release.$$"
}

teardown() {
  rm -f "$FIX"
}

write_fixture() {
  cat >"$FIX" <<EOF
$1
EOF
}

@test "ubuntu 24.04 emits 'ubuntu 24.04 ubuntu'" {
  write_fixture 'ID=ubuntu
VERSION_ID="24.04"
ID_LIKE=debian'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "ubuntu 24.04 ubuntu" ]
}

@test "ubuntu 25.04 emits 'ubuntu 25.04 ubuntu'" {
  write_fixture 'ID=ubuntu
VERSION_ID="25.04"
ID_LIKE=debian'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "ubuntu 25.04 ubuntu" ]
}

@test "debian 13 trixie emits 'debian 13 debian'" {
  write_fixture 'ID=debian
VERSION_ID="13"'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "debian 13 debian" ]
}

@test "ID_LIKE ubuntu derivative emits ubuntu family" {
  write_fixture 'ID="pop"
VERSION_ID="24.04"
ID_LIKE="ubuntu debian"'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "ubuntu 24.04 pop" ]
}

@test "missing os-release emits unsupported" {
  run env OSRELEASE="/nonexistent/path/$$" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "unsupported unknown unknown" ]
}

@test "unknown distro with no ID_LIKE emits unsupported" {
  write_fixture 'ID="weirdos"
VERSION_ID="1.0"'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "unsupported 1.0 weirdos" ]
}

@test "rhel-family is no longer supported -> unsupported" {
  write_fixture 'ID="rocky"
VERSION_ID="9.3"
ID_LIKE="rhel centos fedora"'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "unsupported 9.3 rocky" ]
}

@test "back-compat: awk '{print \$1}' yields family token" {
  write_fixture 'ID="debian"
VERSION_ID="13"'
  family="$(env OSRELEASE="$FIX" "$SCRIPT" | awk '{print $1}')"
  [ "$family" = "debian" ]
  version="$(env OSRELEASE="$FIX" "$SCRIPT" | awk '{print $2}')"
  [ "$version" = "13" ]
}
