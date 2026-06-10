#!/usr/bin/env bash
set -euo pipefail

missing=0
for name in CSC_LINK CSC_KEY_PASSWORD RUNNER_TEMP; do
	if [[ -z "${!name:-}" ]]; then
		echo "::error::Missing required environment variable: ${name}"
		missing=1
	fi
done
if [[ "$missing" -ne 0 ]]; then
	exit 1
fi

CERTIFICATE_PATH="${RUNNER_TEMP}/developer-id-application.p12"
KEYCHAIN_PATH="${RUNNER_TEMP}/writeme-signing.keychain-db"
KEYCHAIN_UNLOCK="${KEYCHAIN_UNLOCK:-$(uuidgen)}"

if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
	echo "::add-mask::${KEYCHAIN_UNLOCK}"
fi

export CERTIFICATE_PATH
python3 - <<'PY'
import base64
import os
from pathlib import Path

Path(os.environ["CERTIFICATE_PATH"]).write_bytes(
    base64.b64decode(os.environ["CSC_LINK"])
)
PY

security create-keychain -p "${KEYCHAIN_UNLOCK}" "${KEYCHAIN_PATH}"
security set-keychain-settings -lut 21600 "${KEYCHAIN_PATH}"
security unlock-keychain -p "${KEYCHAIN_UNLOCK}" "${KEYCHAIN_PATH}"
security import "${CERTIFICATE_PATH}" \
	-k "${KEYCHAIN_PATH}" \
	-P "${CSC_KEY_PASSWORD}" \
	-T /usr/bin/codesign \
	-T /usr/bin/security
security set-key-partition-list \
	-S apple-tool:,apple:,codesign: \
	-s \
	-k "${KEYCHAIN_UNLOCK}" \
	"${KEYCHAIN_PATH}"

# Keep the temporary signing keychain first so @electron/osx-sign can discover
# the imported Developer ID Application identity automatically.
security list-keychains -d user -s \
	"${KEYCHAIN_PATH}" \
	$(security list-keychains -d user | tr -d '"')

security find-identity -v -p codesigning "${KEYCHAIN_PATH}"

if [[ -n "${GITHUB_ENV:-}" ]]; then
	{
		echo "KEYCHAIN_PATH=${KEYCHAIN_PATH}"
		echo "KEYCHAIN_UNLOCK=${KEYCHAIN_UNLOCK}"
	} >>"${GITHUB_ENV}"
fi
