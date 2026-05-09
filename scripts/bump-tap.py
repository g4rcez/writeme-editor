#!/usr/bin/env python3
"""
Usage: python3 scripts/bump-tap.py <version> <artifacts-dir> <tap-dir>

Updates version and SHA256 values in:
  <tap-dir>/Casks/writeme.rb
  <tap-dir>/Formula/writeme.rb

Expects these files in <artifacts-dir>:
  writeme-<version>-arm64.dmg
  writeme-<version>-x64.dmg
  writeme-darwin-arm64
  writeme-darwin-x64
"""
import hashlib
import glob
import re
import sys
from pathlib import Path


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def update_rb(path: str, version: str, arm64_sha: str, x64_sha: str) -> None:
    content = Path(path).read_text(encoding="utf-8")
    content = re.sub(r'version "[0-9a-zA-Z._-]+"', f'version "{version}"', content)
    content = re.sub(
        r'(on_arm do.*?sha256 ")[^"]*(")',
        lambda m: m.group(1) + arm64_sha + m.group(2),
        content,
        flags=re.DOTALL,
    )
    content = re.sub(
        r'(on_intel do.*?sha256 ")[^"]*(")',
        lambda m: m.group(1) + x64_sha + m.group(2),
        content,
        flags=re.DOTALL,
    )
    Path(path).write_text(content, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)

    version, artifacts_dir, tap_dir = sys.argv[1], sys.argv[2], sys.argv[3]

    arm64_dmg_matches = glob.glob(f"{artifacts_dir}/writeme-*-arm64.dmg")
    x64_dmg_matches = glob.glob(f"{artifacts_dir}/writeme-*-x64.dmg")
    cli_arm64 = f"{artifacts_dir}/writeme-darwin-arm64"
    cli_x64 = f"{artifacts_dir}/writeme-darwin-x64"

    missing = []
    if not arm64_dmg_matches:
        missing.append("writeme-*-arm64.dmg")
    if not x64_dmg_matches:
        missing.append("writeme-*-x64.dmg")
    if not Path(cli_arm64).exists():
        missing.append("writeme-darwin-arm64")
    if not Path(cli_x64).exists():
        missing.append("writeme-darwin-x64")
    if missing:
        print(f"ERROR: missing artifacts: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    if len(arm64_dmg_matches) != 1:
        print(f"ERROR: expected exactly one arm64 DMG, found {len(arm64_dmg_matches)}: {arm64_dmg_matches}", file=sys.stderr)
        sys.exit(1)
    if len(x64_dmg_matches) != 1:
        print(f"ERROR: expected exactly one x64 DMG, found {len(x64_dmg_matches)}: {x64_dmg_matches}", file=sys.stderr)
        sys.exit(1)

    arm64_dmg = arm64_dmg_matches[0]
    x64_dmg = x64_dmg_matches[0]

    cask_rb = Path(f"{tap_dir}/Casks/writeme.rb")
    formula_rb = Path(f"{tap_dir}/Formula/writeme.rb")
    missing_tap = []
    if not cask_rb.exists():
        missing_tap.append(str(cask_rb))
    if not formula_rb.exists():
        missing_tap.append(str(formula_rb))
    if missing_tap:
        print(f"ERROR: missing tap files: {', '.join(missing_tap)}", file=sys.stderr)
        sys.exit(1)

    arm64_dmg_sha = sha256(arm64_dmg)
    x64_dmg_sha = sha256(x64_dmg)
    cli_arm64_sha = sha256(cli_arm64)
    cli_x64_sha = sha256(cli_x64)

    update_rb(f"{tap_dir}/Casks/writeme.rb", version, arm64_dmg_sha, x64_dmg_sha)
    update_rb(f"{tap_dir}/Formula/writeme.rb", version, cli_arm64_sha, cli_x64_sha)

    print(f"Bumped to v{version}")
    print(f"  arm64 DMG : {arm64_dmg_sha}")
    print(f"  x64 DMG   : {x64_dmg_sha}")
    print(f"  CLI arm64 : {cli_arm64_sha}")
    print(f"  CLI x64   : {cli_x64_sha}")


if __name__ == "__main__":
    main()
