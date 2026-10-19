#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$project_root/scripts/java.sh"
classes_directory="$project_root/build/classes"
mkdir -p "$classes_directory"

sources=()
while IFS= read -r -d '' source_file; do
  sources+=("$source_file")
done < <(find "$project_root/src/main/java" -name '*.java' -type f -print0)

"$javac_command" --release 21 -encoding UTF-8 -d "$classes_directory" "${sources[@]}"
"$java_command" -Djava.awt.headless=true -cp "$classes_directory" com.weddinginvitation.SiteGenerator "$project_root" "$@"
