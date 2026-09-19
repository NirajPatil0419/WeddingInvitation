#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$project_root/scripts/build.sh"
java -m jdk.httpserver --bind-address 127.0.0.1 --port "${1:-8080}" --directory "$project_root/dist"
