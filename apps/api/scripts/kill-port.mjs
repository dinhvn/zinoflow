// Frees the API port (default 3001, or $PORT) before `nest start`,
// so a leftover watcher from a previous run doesn't cause EADDRINUSE.
// Cross-platform: Windows reuses kill-port.ps1, macOS/Linux use lsof.
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_API_PORT = 3001;
const port = Number(process.env.PORT) || DEFAULT_API_PORT;

if (process.platform === "win32") {
  const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "kill-port.ps1");
  spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
    stdio: "inherit",
  });
  process.exit(0);
}

let pids = [];
try {
  // lsof exits 1 when nothing listens on the port — that's the normal case, not an error.
  const output = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  pids = output.split("\n").map((line) => line.trim()).filter(Boolean);
} catch {
  pids = [];
}

for (const pid of pids) {
  console.log(`kill-port: stopping PID ${pid} on port ${port}`);
  try {
    process.kill(Number(pid), "SIGKILL");
  } catch {
    // Process already exited between lsof and kill — nothing to do.
  }
}
process.exit(0);
