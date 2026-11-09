#!/bin/sh
# @author Stephan Coertzen (coertzen.jfs@gmail.com)
# @license Apache-2.0
# antislopscan is open-source software. See LICENSE.TXT for license information.
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
download_directory=$(mktemp -d)
trap 'rm -rf "$download_directory"' EXIT HUP INT TERM

if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
	printf '%s\n' 'The pinned CI tool bundle supports Linux x86_64.' >&2
	exit 1
fi

version=$(node -p 'require(process.argv[1]).version' "$project_root/config/snyk-ci.json")
binary_sha=$(node -p 'require(process.argv[1]).sha256' "$project_root/config/snyk-ci.json")
license_sha=$(node -p 'require(process.argv[1]).licenseSha256' "$project_root/config/snyk-ci.json")

curl --fail --location --silent --show-error --proto '=https' --max-time 180 \
	"https://downloads.snyk.io/cli/v$version/snyk-linux" -o "$download_directory/snyk"
printf '%s  %s\n' "$binary_sha" "$download_directory/snyk" | sha256sum --check --status
curl --fail --location --silent --show-error --proto '=https' --max-time 60 \
	"https://raw.githubusercontent.com/snyk/cli/v$version/LICENSE" -o "$download_directory/LICENSE"
printf '%s  %s\n' "$license_sha" "$download_directory/LICENSE" | sha256sum --check --status

mkdir -p "$project_root/tools/bin" "$project_root/tools/notices"
install -m 755 "$download_directory/snyk" "$project_root/tools/bin/snyk"
install -m 644 "$download_directory/LICENSE" "$project_root/tools/notices/SNYK-LICENSE"
