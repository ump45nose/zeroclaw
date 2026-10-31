#!/usr/bin/env bash
# Tests install.sh cli_package_version without running the installer (#12154).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SH="$ROOT/install.sh"

if [[ ! -f "$INSTALL_SH" ]]; then
  echo "FAIL: install.sh not found at $INSTALL_SH"
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if ! awk '
  /^cli_package_version\(\) \{/ { in_func = 1 }
  in_func { print }
  in_func && /^}$/ { found = 1; exit }
  END { if (!found) exit 1 }
' "$INSTALL_SH" >"$tmp"; then
  echo "FAIL: could not extract cli_package_version() from install.sh"
  exit 1
fi

bash -n "$tmp"

# shellcheck disable=SC1090
source "$tmp"

pass=0
fail=0
failures=()

assert_version() {
  local input="$1" expected="$2" actual
  actual="$(cli_package_version "$input" || true)"
  if [[ "$actual" == "$expected" ]]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    failures+=("input='$input' got='$actual' want='$expected'")
  fi
}

assert_version "zeroclaw 0.8.7 (99bd353)" "0.8.7"
assert_version "zeroclaw 0.8.7 (v0.8.7-33-ge6e4b0486)" "0.8.7"
assert_version "zeroclaw 0.8.5" "0.8.5"

if [[ "$fail" -ne 0 ]]; then
  echo "FAIL: cli_package_version ($fail failed, $pass passed)"
  for f in "${failures[@]}"; do
    echo "  - $f"
  done
  exit 1
fi

echo "PASS: cli_package_version ($pass cases)"
