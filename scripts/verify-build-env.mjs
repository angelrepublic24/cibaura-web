import nextEnv from "@next/env";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

process.env.NODE_ENV ||= "production";
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");
function load(file, modules = {}) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(outputText, {
    exports,
    URL,
    process,
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unknown module ${name}`);
      return modules[name];
    },
  });
  return exports;
}
try {
  const helpers = load("src/lib/public-url.ts");
  const config = load("src/lib/config.ts", { "./public-url": helpers });
  if (process.env.NODE_ENV === "production") {
    load("src/lib/deployment-policy.ts").assertSameSite(
      config.SITE_URL,
      new URL(config.API_URL),
    );
    config.assertRequiredFeatures(
      process.env.ALLOW_DEFAULT_LEGAL === "true",
      process.env.ALLOW_MISSING_MAPS === "true",
    );
  }
  if (process.env.BUILD_ENV_PROBE_API === "true") {
    const response = await fetch(`${config.API_URL}/health`, {
      headers: { Origin: config.SITE_URL.origin },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (
      !response.ok ||
      response.headers.get("access-control-allow-origin") !==
        config.SITE_URL.origin
    )
      throw new Error(
        "API health/CORS probe failed: expected HTTP 2xx and access-control-allow-origin exactly equal to SITE_URL origin (no trailing slash).",
      );
    await response.body?.cancel();
    console.log("Build API/CORS probe: passed");
  }
  console.log("Build configuration: valid");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
