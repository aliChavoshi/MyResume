const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "output", "pdf");
const resumeUrl = pathToFileURL(path.join(root, "index.html")).href;

// Playwright used to be pulled from one hard-coded path inside a tool cache on
// a single machine, which meant this script only ran there. Resolve it the
// normal way and fall back to a couple of common locations.
function loadPlaywright() {
  const candidates = [
    "playwright",
    "playwright-core",
    path.join(root, "node_modules", "playwright"),
  ];
  for (const id of candidates) {
    try {
      return require(id);
    } catch (err) {
      /* try the next one */
    }
  }
  throw new Error(
    "Playwright not found. Run `npm install -D playwright` in the project root,\n" +
      "then `npx playwright install chromium`.",
  );
}

const { chromium } = loadPlaywright();

async function createResume(browser, language, filename) {
  console.log(`Creating ${language.toUpperCase()} PDF...`);

  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });

  // Drive the language through the URL rather than by clicking the toggle:
  // the toggle is a UI detail, ?lang= is the page's own supported entry point.
  // ?print=1 also pins the light theme regardless of the OS preference.
  await page.goto(`${resumeUrl}?lang=${language}&print=1`, {
    waitUntil: "load",
    timeout: 30000,
  });

  // Vazirmatn and Inter come from Google Fonts. The previous version aborted
  // those requests, so both PDFs fell back to whatever the host had installed
  // and the Persian one in particular no longer matched the site. Wait for the
  // real faces, but do not fail the export if the network is unavailable.
  try {
    await page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 15000 });
  } catch (err) {
    console.warn("  Web fonts did not finish loading; falling back to system fonts.");
  }

  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(400);

  await page.pdf({
    path: path.join(outputDir, filename),
    // The page size comes from `@page { size: A4 }` in styles.css, so there is
    // a single source of truth. Passing `format` as well used to fight it and
    // the output came out as US Letter.
    preferCSSPageSize: true,
    printBackground: true,
  });

  await page.close();

  const bytes = fs.statSync(path.join(outputDir, filename)).size;
  console.log(`  ${filename} — ${(bytes / 1024).toFixed(0)} KB`);
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const requested = process.argv[2];
    if (!requested || requested === "en") {
      await createResume(browser, "en", "Ali-Chavoshi-Resume-EN.pdf");
    }
    if (!requested || requested === "fa") {
      await createResume(browser, "fa", "Ali-Chavoshi-Resume-FA.pdf");
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
