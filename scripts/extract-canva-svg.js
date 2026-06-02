const fs = require("fs");
const path = require("path");

const transcriptPath =
  process.argv[2] ||
  "C:/Users/delanget/.cursor/projects/c-Users-delanget-Documents-GitHub-PropertyGuy/agent-transcripts/3bb87d5f-b788-4060-9fb9-379e18ceac8d/3bb87d5f-b788-4060-9fb9-379e18ceac8d.jsonl";
const outPath =
  process.argv[3] ||
  "C:/Users/delanget/Documents/GitHub/PropertyGuy/frontend/public/assets/brand/proplytic-mark-canva.svg";

function extractSvgFromText(text) {
  const start = text.indexOf("<svg");
  if (start < 0) return null;
  const end = text.lastIndexOf("</svg>");
  if (end < start) return null;
  return text.slice(start, end + 6);
}

function collectTextFromLine(line) {
  const texts = [];
  try {
    const obj = JSON.parse(line);
    const content = obj.message?.content;
    if (typeof content === "string") texts.push(content);
    else if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part === "string") texts.push(part);
        else if (part?.text) texts.push(part.text);
      }
    }
  } catch {
    if (line.includes("<svg")) texts.push(line);
  }
  return texts;
}

const raw = fs.readFileSync(transcriptPath, "utf8");
const lines = raw.split("\n");

let best = null;
for (const line of lines) {
  if (!line.includes("<svg")) continue;
  for (const text of collectTextFromLine(line)) {
    const svg = extractSvgFromText(text);
    if (svg && (!best || svg.length > best.length)) best = svg;
  }
}

if (!best) {
  console.error("SVG not found in transcript");
  process.exit(1);
}

best = best.replace(/viewBox="0 0 1500 1499\.999933"/, 'viewBox="0 0 1500 1500"');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, best);

const canonical = path.join(path.dirname(outPath), "proplytic-mark.svg");
fs.writeFileSync(canonical, best);

console.log("Wrote", outPath, fs.statSync(outPath).size, "bytes");
console.log("Wrote", canonical, fs.statSync(canonical).size, "bytes");
