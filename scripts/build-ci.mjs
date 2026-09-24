/** Non-production compilation only. Docker never consumes .next-ci artifacts. */
import { spawn, execFileSync } from "node:child_process";
import { resolve } from "node:path";

const child = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "build", "--turbopack"],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_BUILD_SHA: execFileSync(
        "git",
        [
          "-c",
          `safe.directory=${process.cwd().replaceAll("\\", "/")}`,
          "rev-parse",
          "HEAD",
        ],
        { encoding: "utf8" },
      ).trim(),
      NEXT_PUBLIC_SITE_URL: "https://web.ci.invalid",
      NEXT_PUBLIC_API_URL: "https://api.ci.invalid",
      NEXT_PUBLIC_MEDIA_URL: "https://media.ci.invalid/public/",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY: "false",
    },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
