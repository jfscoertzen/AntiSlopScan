#!/bin/sh
# @author Stephan Coertzen (coertzen.jfs@gmail.com)
# @license Apache-2.0
# antislopscan is open-source software. See LICENSE.TXT for license information.
set -eu

image=${1:?Supply the verified Docker image name}
output=${2:?Supply an output directory}
version=$(node -p "require('./package.json').version")
work=$(mktemp -d)
container=''

cleanup() {
    if [ -n "$container" ]; then docker rm "$container" >/dev/null; fi
    rm -rf "$work"
}
trap cleanup EXIT HUP INT TERM
mkdir -p "$output" "$work/release/bin" "$work/release/app"
container=$(docker create "$image")
docker cp "$container:/usr/local/bin/node" "$work/release/bin/node"
docker cp "$container:/app/artifacts/." "$work/artifacts"
set -- "$work"/artifacts/antislopscan-*.tgz
[ "$#" -eq 1 ] && [ -f "$1" ]
cp "$1" "$output/antislopscan-$version.tgz"
tar -xzf "$1" -C "$work/release/app" --strip-components=1
cat > "$work/release/bin/antislopscan" <<'LAUNCHER'
#!/bin/sh
# @author Stephan Coertzen (coertzen.jfs@gmail.com)
# @license Apache-2.0
# antislopscan is open-source software. See LICENSE.TXT for license information.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec "$root/bin/node" "$root/app/dist/cli.js" "$@"
LAUNCHER
chmod 755 "$work/release/bin/node" "$work/release/bin/antislopscan"
"$work/release/bin/antislopscan" --help >/dev/null
tar -czf "$output/antislopscan-$version-linux-x64.tar.gz" -C "$work/release" .
(cd "$output" && sha256sum "antislopscan-$version.tgz" "antislopscan-$version-linux-x64.tar.gz" > SHA256SUMS)
