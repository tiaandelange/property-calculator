import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { injectMetaIntoIndexHtml } from "./socialPreview.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexTemplate = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");

describe("injectMetaIntoIndexHtml", () => {
  it("preserves viewport and charset when updating home SEO meta", () => {
    const html = injectMetaIntoIndexHtml(indexTemplate, {
      title: "Proplytic | Property Portfolio Software South Africa",
      description: "Property management and investment analytics software for South African landlords.",
      path: "/"
    });

    expect(html).toContain('meta name="viewport" content="width=device-width, initial-scale=1"');
    expect(html).toContain('meta charset="UTF-8"');
    expect(html).toContain("<title>Proplytic | Property Portfolio Software South Africa</title>");
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:image:alt"');
    expect(html).not.toMatch(/<meta[^>]*name="twitter:image"[^>]*>[\s\S]*<meta charset/i);
  });
});
