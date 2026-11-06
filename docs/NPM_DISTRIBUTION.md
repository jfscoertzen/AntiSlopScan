# npm distribution

The package name and executable are both `antislopscan`. The public registry
returned 404 during verification on 2026-11-05; this work prepares an installable
release and does not publish it to an npm account.

## Install a tarball or published release

```sh
npm install --global --ignore-scripts ./antislopscan-1.0.0-alpha.1.tgz
antislopscan --help
antislopscan cli --profile portable --source /path/to/source --output /path/to/reports
antislopscan gui --profile portable --source /path/to/source --port 3000
```

After the maintainer publishes this package:

```sh
npm install --global --registry=https://registry.npmjs.org --ignore-scripts antislopscan
```

This npm release supports Linux x86_64 with glibc and Node 22.22.3+; use the
linux/amd64 Docker appliance on other hosts. `portable` needs no Python environment, browser, audited
project dependencies, or repository configuration. On Linux, install util-linux
so `/usr/bin/prlimit` exists. The CLI remains usable from a local dependency
through `npm exec -- antislopscan`; both global and local installs are tested.
The GUI uses the same package's compiled Vue assets, defaults to localhost:3000,
and stores history outside the audited source in the user's state directory.

The portable profile explicitly disables Rust AntiSlop, Semgrep, Gitleaks, Ruff,
and Radon and selects HTML/JSON/SARIF. It reports those tools as skipped; it never
claims the full appliance ran. Explicit JSON scanner/report settings override
the profile. `--profile full` keeps the original native/Python/PDF defaults and
reports unavailable prerequisites as failures, preserving the CI contract.

## Optional full toolchain

The Docker appliance includes these prerequisites and is the simplest full setup.
For an npm installation, the native bundle supports Linux x86_64 and needs Python
3.11+, curl, tar, sha256sum, util-linux, and write access to the package directory.
Run the following as the owner of the installed package:

```sh
ANTISLOPSCAN_INSTALL_ROOT="$(npm root --global)/antislopscan"
python3 -m venv "$ANTISLOPSCAN_INSTALL_ROOT/tools/python"
"$ANTISLOPSCAN_INSTALL_ROOT/tools/python/bin/pip" install \
  -r "$ANTISLOPSCAN_INSTALL_ROOT/tools/requirements.lock"
sh "$ANTISLOPSCAN_INSTALL_ROOT/scripts/install-native-tools.sh"
npm exec --package=playwright@1.56.0 -- playwright install --with-deps chromium
antislopscan cli --profile full --source /path/to/source --output /path/to/reports
```

Browser system dependencies may require administrator rights. Installation uses
network access for pinned packages, checksum-verified archives, and Chromium;
subsequent scans work offline. These are operator installation commands and are
never run against an audited repository. Native/Python environments and Chromium
are excluded from the npm tarball; their licenses/source archives are retained by
the explicit native installer and Docker image.

## Build and verify a release

```sh
npm ci
npm run build
npm run check:docs
npm test
npm run package
npm run test:package
```

`package` builds TypeScript and Vue, transpiles the unmodified vendored plugin
into JavaScript, and checks runtime assets/notices and installed versions against
`package-lock.json`. It bundles the production dependency closure and packs
`artifacts/antislopscan-VERSION.tgz`; the version comes from `package.json`.
`config/npm-dependencies.lock.json` is generated provenance copied from the
authoritative lockfile. Development dependencies are excluded. Consumers install
the complete runtime without build hooks or registry dependency downloads.

npm 12 removed shrinkwrap support; bundling the locked dependency tree is its
documented replacement. See the [official npm changelog](https://github.com/npm/cli/blob/latest/CHANGELOG.md).
The package declares its platform because bundled scanner bindings target the
build platform. New platform releases require corresponding tested bindings.

The package file allowlist excludes private configuration, caches, local state,
test artifacts, native binaries, and Python virtual environments. It includes
compiled assets, original sources, third-party provenance/licenses, schemas,
trusted scanner policy, and full-setup instructions. Node does not strip types
inside `node_modules`, so Oxlint loads compiled JavaScript rules while their
original MIT sources remain included and unchanged.

`test:package` installs the real tarball into fresh global and local prefixes
offline with an empty npm cache and install scripts disabled. It runs all npm
scanner adapters, verifies exact report folders, then starts/stops the packaged
GUI and checks its portable defaults. This verifies that the tarball is sufficient
for installation rather than relying on the developer's installed dependencies.

## Publish

Publish only the verified tarball from an npm account authorized to own the name:

```sh
npm login --registry=https://registry.npmjs.org
npm publish ./artifacts/antislopscan-1.0.0-alpha.1.tgz --access public --registry=https://registry.npmjs.org
```

Use the current `package.json` version when preparing later releases. npm may
require the account's two-factor verification or trusted publishing setup.
No credentials or registry tokens are stored in this repository. Publishing is
a separate maintainer action; building and testing do not publish anything.
