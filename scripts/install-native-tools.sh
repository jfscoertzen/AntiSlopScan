#!/bin/sh
# @author Stephan Coertzen (coertzen.jfs@gmail.com)
# @license Apache-2.0
# antislopscan is open-source software. See LICENSE.TXT for license information.
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
download_directory=$(mktemp -d)
trap 'rm -rf "$download_directory"' EXIT HUP INT TERM

if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
	printf '%s\n' 'The pinned native tool bundle supports Linux x86_64. Use the linux/amd64 Docker image.' >&2
	exit 1
fi

mkdir -p "$project_root/tools/bin" "$project_root/tools/notices" "$project_root/tools/sources"
curl --fail --location --silent --show-error --proto '=https' \
	https://github.com/skew202/antislop/releases/download/v0.3.0/antislop-x86_64-unknown-linux-gnu.tar.gz \
	-o "$download_directory/antislop.tar.gz"
printf '%s  %s\n' '3da0e84aec707b653be6f69355159467a3d815e833e1e0970f1a14d90f4e6e7c' "$download_directory/antislop.tar.gz" | sha256sum --check --status
tar -xzf "$download_directory/antislop.tar.gz" -C "$project_root/tools/bin" antislop

curl --fail --location --silent --show-error --proto '=https' \
	https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz \
	-o "$download_directory/gitleaks.tar.gz"
printf '%s  %s\n' '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb' "$download_directory/gitleaks.tar.gz" | sha256sum --check --status
tar -xzf "$download_directory/gitleaks.tar.gz" -C "$project_root/tools/bin" gitleaks
tar -xzf "$download_directory/gitleaks.tar.gz" -C "$project_root/tools/notices" LICENSE
mv "$project_root/tools/notices/LICENSE" "$project_root/tools/notices/GITLEAKS-LICENSE"

curl --fail --location --silent --show-error --proto '=https' \
	https://codeload.github.com/skew202/antislop/tar.gz/v0.3.0 \
	-o "$project_root/tools/sources/antislop-v0.3.0.tar.gz"
printf '%s  %s\n' '19b11bdb1e34ec5ca1ec368b2a79c65090273637febcb89d308a60b890b7bd6c' "$project_root/tools/sources/antislop-v0.3.0.tar.gz" | sha256sum --check --status

curl --fail --location --silent --show-error --proto '=https' \
	https://codeload.github.com/semgrep/semgrep/tar.gz/refs/tags/v1.183.0 \
	-o "$project_root/tools/sources/semgrep-v1.183.0.tar.gz"
printf '%s  %s\n' '58f76c8e66da8f7d0eb1950df07a539ffcf15accf8d5b303213252b08297d82a' "$project_root/tools/sources/semgrep-v1.183.0.tar.gz" | sha256sum --check --status
tar -xOf "$project_root/tools/sources/semgrep-v1.183.0.tar.gz" semgrep-1.183.0/LICENSE > "$project_root/tools/notices/SEMGREP-LICENSE"

"$project_root/tools/bin/antislop" --version
"$project_root/tools/bin/gitleaks" version
