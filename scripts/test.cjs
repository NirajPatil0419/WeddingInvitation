const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error("Node.js 22 or newer is required for the checks. See .nvmrc and README.md.");
  process.exit(1);
}
run(process.execPath, ["scripts/build.cjs"]);
let javaHome = process.env.JAVA_HOME;
if (process.platform === "win32") {
  const directory = path.join(root, "build/toolchains");
  const local =
    fs.existsSync(directory) &&
    fs
      .readdirSync(directory)
      .filter((name) => name.startsWith("jdk-21"))
      .sort()
      .at(-1);
  if (local) javaHome = path.join(directory, local);
}
const executable = (name) =>
  javaHome ? path.join(javaHome, "bin", name + (process.platform === "win32" ? ".exe" : "")) : name;
fs.mkdirSync(path.join(root, "build/test-classes"), { recursive: true });
run(executable("javac"), [
  "--release",
  "21",
  "-encoding",
  "UTF-8",
  "-cp",
  "build/classes",
  "-d",
  "build/test-classes",
  "tests/java/GeneratorChecks.java",
]);
run(executable("java"), [
  "-Djava.awt.headless=true",
  "-cp",
  `build/classes${path.delimiter}build/test-classes`,
  "GeneratorChecks",
  root,
]);
run(process.execPath, ["tests/browser/interaction-check.cjs"]);
run(process.execPath, ["tests/browser/visual-check.cjs"]);
