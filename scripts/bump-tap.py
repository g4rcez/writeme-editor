#!/usr/bin/env python3
"""
Usage: python3 scripts/bump-tap.py <version> <artifacts-dir> <tap-dir>

Updates version and SHA256 values in:
  <tap-dir>/Casks/writeme.rb
  <tap-dir>/Formula/writeme.rb

Expects these files in <artifacts-dir>:
  writeme-<version>-arm64.dmg or writeme-<version>-arm64-unsigned.dmg
  writeme-darwin-arm64
"""

import glob
import hashlib
import re
import sys
from pathlib import Path


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def update_rb(path: str, version: str, arm64_sha: str) -> None:
    content = Path(path).read_text(encoding="utf-8")
    content = re.sub(r'version "[0-9a-zA-Z._-]+"', f'version "{version}"', content)
    content = re.sub(
        r'(on_arm do.*?sha256 ")[^"]*(")',
        lambda m: m.group(1) + arm64_sha + m.group(2),
        content,
        flags=re.DOTALL,
    )
    content = re.sub(r"\n\s*on_intel do\n.*?\n\s*end\n", "\n", content, flags=re.DOTALL)
    Path(path).write_text(content, encoding="utf-8")


def update_cask(path: str, version: str, arm64_sha: str, dmg_path: str) -> None:
    content = Path(path).read_text(encoding="utf-8")
    dmg_name = Path(dmg_path).name
    dmg_name_template = dmg_name.replace(version, "#{version}")
    arm_url = (
        "https://github.com/g4rcez/writeme-editor/releases/download/"
        f"v#{{version}}/{dmg_name_template}"
    )

    content = re.sub(r'version "[0-9a-zA-Z._-]+"', f'version "{version}"', content)
    content = re.sub(
        r'(on_arm do.*?url ")[^"]*(")',
        lambda m: m.group(1) + arm_url + m.group(2),
        content,
        flags=re.DOTALL,
    )
    content = re.sub(
        r'(on_arm do.*?sha256 ")[^"]*(")',
        lambda m: m.group(1) + arm64_sha + m.group(2),
        content,
        flags=re.DOTALL,
    )
    content = re.sub(r"\n\s*on_intel do\n.*?\n\s*end\n", "\n", content, flags=re.DOTALL)
    content = re.sub(r"\n\s*no_quarantine true\n", "\n", content)

    if "-unsigned.dmg" in dmg_name:
        content = re.sub(
            r'(homepage "https://writeme.dev"\n)',
            r"\1\n  no_quarantine true\n",
            content,
            count=1,
        )

    Path(path).write_text(content, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)

    version, artifacts_dir, tap_dir = sys.argv[1], sys.argv[2], sys.argv[3]

    arm64_dmg_matches = glob.glob(f"{artifacts_dir}/writeme-*-arm64*.dmg")
    cli_arm64 = f"{artifacts_dir}/writeme-darwin-arm64"

    missing = []
    if not arm64_dmg_matches:
        missing.append("writeme-*-arm64*.dmg")
    if not Path(cli_arm64).exists():
        missing.append("writeme-darwin-arm64")
    if missing:
        print(f"ERROR: missing artifacts: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    if len(arm64_dmg_matches) != 1:
        print(
            f"ERROR: expected exactly one arm64 DMG, found {len(arm64_dmg_matches)}: {arm64_dmg_matches}",
            file=sys.stderr,
        )
        sys.exit(1)

    arm64_dmg = arm64_dmg_matches[0]

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
    cli_arm64_sha = sha256(cli_arm64)

    update_cask(f"{tap_dir}/Casks/writeme.rb", version, arm64_dmg_sha, arm64_dmg)
    update_rb(f"{tap_dir}/Formula/writeme.rb", version, cli_arm64_sha)

    print(f"Bumped to v{version}")
    print(f"  arm64 DMG : {arm64_dmg_sha}")
    print(f"  CLI arm64 : {cli_arm64_sha}")


if __name__ == "__main__":
    main()
