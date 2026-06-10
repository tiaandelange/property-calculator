/**
 * Single-file ESM bundle for report PDF serverless routes.
 * Vercel Root Directory = frontend; @vercel/node may not resolve ./propertyCalculator/*.js
 * from propertyCalculatorServer.ts at runtime — bundling avoids FUNCTION_INVOCATION_FAILED.
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const entry = path.join(frontendRoot, "api/_lib/propertyCalculatorServer.entry.ts");
const outfile = path.join(frontendRoot, "api/_lib/propertyCalculator.server.mjs");

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile,
  logLevel: "info"
});

console.info("[bundle-property-calculator-server] wrote", outfile);
