#!/usr/bin/env bash
# Sourced by the build and preview commands.
if [[ -n "${JAVA_HOME:-}" ]]; then
  java_command="$JAVA_HOME/bin/java"
  javac_command="$JAVA_HOME/bin/javac"
else
  java_command="java"
  javac_command="javac"
fi
for command in "$java_command" "$javac_command"; do
  version="$("$command" --version 2>&1 | head -n 1)" || { echo 'JDK 21 is required. Set JAVA_HOME.' >&2; exit 1; }
  if [[ ! "$version" =~ (javac|openjdk|java)[[:space:]]+([0-9]+) ]] || (( BASH_REMATCH[2] < 21 )); then
    echo "JDK 21 or newer is required; found $version. Set JAVA_HOME to JDK 21." >&2
    exit 1
  fi
done
