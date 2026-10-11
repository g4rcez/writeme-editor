#!/usr/bin/env bash
set -euo pipefail
trap 'printf "\nInstallation stopped. Fix the error above and run this script again.\n" >&2' ERR

revision=d1be6fde11ac6e0407606b4e42fe72d34add8037
model_hash=60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe
system=$(uname -s)
if [ "$(id -u)" -eq 0 ]; then
    printf 'Run this script as your regular user. It will request permission for dependencies when needed.\n' >&2
    exit 1
fi

case "$system" in
    Darwin)
        install_dir="${WRITEME_WHISPER_DIR:-$HOME/Library/Application Support/Writeme/whisper}"
        for brew_path in /opt/homebrew/bin/brew /usr/local/bin/brew; do
            if [ -x "$brew_path" ]; then eval "$("$brew_path" shellenv)"; break; fi
        done
        if ! command -v brew >/dev/null 2>&1; then
            brew_installer=$(mktemp)
            curl --fail --location --retry 3 https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$brew_installer"
            /bin/bash "$brew_installer"
            for brew_path in /opt/homebrew/bin/brew /usr/local/bin/brew; do
                if [ -x "$brew_path" ]; then eval "$("$brew_path" shellenv)"; break; fi
            done
        fi
        if ! command -v cmake >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
            brew install cmake ffmpeg
        fi
        if ! xcrun --find clang >/dev/null 2>&1; then
            xcode-select --install
            printf 'Approve the Apple developer tools installation, then run this script again.\n' >&2
            exit 1
        fi
        ;;
    Linux)
        install_dir="${WRITEME_WHISPER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/writeme/whisper}"
        if ! command -v cmake >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1 || ! command -v c++ >/dev/null 2>&1 || ! command -v make >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
            if command -v apt-get >/dev/null 2>&1; then
                sudo apt-get update
                sudo apt-get install -y build-essential cmake ffmpeg curl ca-certificates
            elif command -v dnf >/dev/null 2>&1; then
                sudo dnf install -y gcc-c++ make cmake ffmpeg-free curl ca-certificates
            elif command -v pacman >/dev/null 2>&1; then
                sudo pacman -Syu --needed --noconfirm base-devel cmake ffmpeg curl ca-certificates
            else
                printf 'Automatic dependency installation supports apt, dnf and pacman. Install a C++ compiler, make, CMake, FFmpeg and curl, then rerun.\n' >&2
                exit 1
            fi
        fi
        ;;
    *) printf 'This installer supports macOS and Linux. Use the PowerShell installer on Windows.\n' >&2; exit 1 ;;
esac

printf 'Installing local transcription in %s\n' "$install_dir"
mkdir -p "$install_dir"
source_dir="$install_dir/whisper.cpp-$revision"
if [ ! -f "$source_dir/.source-ready" ]; then
    curl --fail --location --retry 3 "https://github.com/ggml-org/whisper.cpp/archive/$revision.tar.gz" -o "$install_dir/source.tar.gz"
    tar -xzf "$install_dir/source.tar.gz" -C "$install_dir"
    touch "$source_dir/.source-ready"
fi
cmake -S "$source_dir" -B "$source_dir/build" -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_SERVER=ON -DGGML_NATIVE=OFF
cmake --build "$source_dir/build" --config Release --target whisper-server --parallel 4

verify_model() {
    [ -f "$1" ] || return 1
    if command -v sha256sum >/dev/null 2>&1; then
        printf '%s  %s\n' "$model_hash" "$1" | sha256sum -c - >/dev/null 2>&1
    else
        printf '%s  %s\n' "$model_hash" "$1" | shasum -a 256 -c - >/dev/null 2>&1
    fi
}

model="$source_dir/models/ggml-base.bin"
if ! verify_model "$model"; then
    curl --fail --location --retry 3 https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -o "$model.part"
    if ! verify_model "$model.part"; then
        printf 'Model checksum verification failed. Run the script again to retry the download.\n' >&2
        exit 1
    fi
    mv "$model.part" "$model"
fi

launcher="$install_dir/start-whisper.sh"
printf '#!/usr/bin/env bash\nset -euo pipefail\ncd -- %q\nexec ./build/bin/whisper-server --model models/ggml-base.bin --threads 4 --host 127.0.0.1 --port 8080 --convert --language auto\n' "$source_dir" > "$launcher"
chmod +x "$launcher"
printf '\nStarting local transcription at http://localhost:8080/inference.\nKeep this terminal open. Press Ctrl+C to stop.\nTo start again: bash "%s"\n\n' "$launcher"
exec bash "$launcher"
