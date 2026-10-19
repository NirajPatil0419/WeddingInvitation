const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const windows = process.platform === "win32";
const result = spawnSync(
  windows ? "powershell.exe" : "bash",
  windows
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "scripts/build.ps1")]
    : [path.join(root, "scripts/build.sh")],
  { cwd: root, stdio: "inherit" },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
