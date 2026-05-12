import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import PdfPrinter from "pdfmake";

// Why this file no longer touches pdfmake's bundled virtual-font-system file
// (the one under pdfmake/build/...): it is a browser/UMD bundle that we used
// to load via a runtime createRequire(...). Static bundlers (Vercel's
// node-file-trace, esbuild, ncc, ...) cannot trace that dynamic require, so
// on Vercel the file gets stripped from the function bundle and the runtime
// throws the now-famous "Cannot find module" error at startup.
//
// pdfmake's npm distribution also does NOT ship `examples/fonts`, so we can't
// fall back to its on-disk fonts either.
//
// Instead we ship the four Roboto TTFs we need under `backend/assets/fonts/`.
// They were extracted once via `backend/scripts/extract-pdfmake-fonts.mjs`;
// PdfPrinter loads them straight from disk — no virtual file system involved.
//
// We deliberately avoid `import.meta.url` here because the test harness
// (ts-jest) compiles this file to CommonJS, which forbids `import.meta`.
// `createRequire` works identically in ESM (runtime) and CJS (jest), so we
// use it to anchor against the installed pdfmake package. From pdfmake's
// `package.json` location we can climb out of `node_modules` to find the
// backend package root that owns the fonts directory.
//
// For Vercel deployments specifically, see `backend/vercel.json` —
// `functions.*.includeFiles` forces the TTFs into the function bundle, since
// nft cannot follow the dynamic resolution below.

const FONT_FILES = [
  "Roboto-Regular.ttf",
  "Roboto-Medium.ttf",
  "Roboto-Italic.ttf",
  "Roboto-MediumItalic.ttf"
] as const;

function backendRootCandidates(): string[] {
  const set = new Set<string>();

  // Anchor 1: the installed pdfmake package. createRequire works in ESM and
  // CJS, and `require.resolve("pdfmake/package.json")` is a static string
  // pattern that bundlers can follow — which keeps the pdfmake package itself
  // bundled and gives us a stable reference point.
  try {
    const r = createRequire(join(process.cwd(), "package.json"));
    const pdfmakePkg = r.resolve("pdfmake/package.json");
    set.add(resolve(dirname(pdfmakePkg), "..", ".."));
  } catch {
    // ignore — fall through to the other anchors
  }

  // Anchor 2: process.cwd(). On Render (Docker), this is `/app`. On Vercel
  // this is the function's working directory. On local dev (`npm run dev`)
  // it's the `backend/` package root.
  set.add(process.cwd());

  return Array.from(set);
}

function resolveFontDir(): string {
  const tried: string[] = [];
  for (const root of backendRootCandidates()) {
    const dir = join(root, "assets", "fonts");
    tried.push(dir);
    if (FONT_FILES.every((f) => existsSync(join(dir, f)))) return dir;
  }
  throw new Error(
    `Could not locate the Roboto TTFs in backend/assets/fonts. Tried:\n  ${tried.join(
      "\n  "
    )}\nRerun \`node scripts/extract-pdfmake-fonts.mjs\` to regenerate, and make sure assets/fonts is part of the deployment bundle (Vercel: see backend/vercel.json).`
  );
}

let printer: InstanceType<typeof PdfPrinter> | null = null;

export function getPdfPrinter(): InstanceType<typeof PdfPrinter> {
  if (!printer) {
    const dir = resolveFontDir();
    const fonts = {
      Roboto: {
        normal: join(dir, "Roboto-Regular.ttf"),
        bold: join(dir, "Roboto-Medium.ttf"),
        italics: join(dir, "Roboto-Italic.ttf"),
        bolditalics: join(dir, "Roboto-MediumItalic.ttf")
      }
    };
    printer = new PdfPrinter(fonts);
  }
  return printer;
}

export function pdfLibraryLoaded(): boolean {
  try {
    getPdfPrinter();
    return true;
  } catch {
    return false;
  }
}
