/**
 * CI gate: Verify build output is valid.
 * Checks that dist/ contains expected files after `npm run build`.
 *
 * Run: npx tsx scripts/verify-build.ts
 */
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const DIST = join(process.cwd(), "dist");
const errors: string[] = [];

function check(condition: boolean, msg: string) {
  if (!condition) errors.push(msg);
}

// dist/ must exist
check(existsSync(DIST), "dist/ directory does not exist. Did `npm run build` run?");

if (existsSync(DIST)) {
  const files = readdirSync(DIST);

  // Must have index.html (SPA entry)
  check(files.includes("index.html"), "dist/index.html missing");

  // Must have assets/ directory
  check(files.includes("assets"), "dist/assets/ directory missing");

  // Must have service worker
  check(files.includes("sw.js"), "dist/sw.js missing (PWA service worker)");

  // Assets must have at least some JS chunks
  const assetsDir = join(DIST, "assets");
  if (existsSync(assetsDir)) {
    const assets = readdirSync(assetsDir);
    const jsFiles = assets.filter((f) => f.endsWith(".js"));
    const cssFiles = assets.filter((f) => f.endsWith(".css"));
    check(jsFiles.length >= 3, `Expected at least 3 JS chunks, found ${jsFiles.length}`);
    check(cssFiles.length >= 1, `Expected at least 1 CSS file, found ${cssFiles.length}`);

    // Check total bundle size (warn if > 10MB)
    let totalSize = 0;
    for (const f of assets) {
      totalSize += statSync(join(assetsDir, f)).size;
    }
    const totalMB = (totalSize / 1024 / 1024).toFixed(1);
    console.log(`  Bundle size: ${totalMB} MB (${jsFiles.length} JS, ${cssFiles.length} CSS)`);
    if (totalSize > 15 * 1024 * 1024) {
      errors.push(`Bundle too large: ${totalMB} MB (max 15 MB)`);
    }
  }
}

if (errors.length > 0) {
  console.error("\nBuild verification FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("\nBuild verification passed.");
