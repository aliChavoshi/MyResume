const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("C:\\Users\\ac4136\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "output", "pdf");
const resumeUrl = pathToFileURL(path.join(root, "index.html")).href;

const printStyles = `
  @page { size: A4; margin: 10mm; }
  .lang-toggle, .theme-toggle, .download-cv { display: none !important; }
  .page { max-width: none !important; padding: 0 !important; gap: 18px !important; }
  .sidebar { position: static !important; }
  .reveal, .reveal *, .sidebar { opacity: 1 !important; transform: none !important; animation: none !important; }
  .project, .timeline__entry, .cert-card, .edu-card { break-inside: avoid; }
`;

async function createResume(browser, language, filename) {
  console.log(`Creating ${language} PDF...`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  // PDFs should not wait for optional remote web fonts; system fallbacks cover both languages.
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto(resumeUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
  await page.addStyleTag({ content: printStyles });
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
  if (language === "fa") {
    await page.locator("#langToggle").click();
    console.log("Persian layout applied.");
  }
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(600);
  await page.pdf({
    path: path.join(outputDir, filename),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  });
  await page.close();
  console.log(`Created ${filename}.`);
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  try {
    const requestedLanguage = process.argv[2];
    if (!requestedLanguage || requestedLanguage === "en") {
      await createResume(browser, "en", "Ali-Chavoshi-Resume-EN.pdf");
    }
    if (!requestedLanguage || requestedLanguage === "fa") {
      await createResume(browser, "fa", "Ali-Chavoshi-Resume-FA.pdf");
    }
  } finally {
    await browser.close();
  }
})();
