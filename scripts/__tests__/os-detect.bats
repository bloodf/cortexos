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

@test "fedora 41 emits 'fedora 41 fedora'" {
  write_fixture 'ID=fedora
VERSION_ID=41'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "fedora 41 fedora" ]
}

@test "rhel 9.4 emits 'rhel 9.4 rhel'" {
  write_fixture 'ID="rhel"
VERSION_ID="9.4"
ID_LIKE="fedora"'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "rhel 9.4 rhel" ]
}

@test "rocky 9 emits 'rhel 9.3 rocky'" {
  write_fixture 'ID="rocky"
VERSION_ID="9.3"
ID_LIKE="rhel centos fedora"'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "rhel 9.3 rocky" ]
}

@test "almalinux 9 emits 'rhel 9.3 almalinux'" {
  write_fixture 'ID="almalinux"
VERSION_ID="9.3"
ID_LIKE="rhel centos fedora"'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "rhel 9.3 almalinux" ]
}

@test "centos stream emits 'rhel 9 centos'" {
  write_fixture 'ID="centos"
VERSION_ID="9"
ID_LIKE="rhel fedora"'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "rhel 9 centos" ]
}

@test "ID_LIKE rhel derivative emits rhel family" {
  write_fixture 'ID="oraclelinux"
VERSION_ID="9.3"
ID_LIKE="rhel fedora"'
  run env OSRELEASE="$FIX" "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "rhel 9.3 oraclelinux" ]
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

@test "third token is back-compat additive: awk '{print \$1}' still gives family" {
  write_fixture 'ID="rocky"
VERSION_ID="9.3"'
  family="$(env OSRELEASE="$FIX" "$SCRIPT" | awk '{print $1}')"
  [ "$family" = "rhel" ]
  version="$(env OSRELEASE="$FIX" "$SCRIPT" | awk '{print $2}')"
  [ "$version" = "9.3" ]
}
