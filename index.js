import { chromium } from "playwright";
import fs from "fs-extra";
import log4js from "log4js";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Logger configuration
log4js.configure({
  appenders: { file: { type: "file", filename: "logs/une_rpa.log" } },
  categories: { default: { appenders: ["file"], level: "info" } },
});

const logger = log4js.getLogger("default");

// Write text to a file
async function writeTxt(text) {
  const filePath = `Z:\\FISCAL\\Importação\\Tomados\\${new Date()
    .toLocaleDateString("pt-BR")
    .replace(/\//g, "-")}.txt`;
  await fs.appendFile(filePath, text + "\n", "utf-8");
}

// Main automation function
async function uneAutomation(
  monthAbbreviated,
  monthInDigits,
  year,
  progressBar
) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    console.log("Navigating to login page...");
    progressBar.progress(0, "Iniciando o processo...");
    await page.goto("https://app.une.digital/_login/Login.aspx");
    logger.info("Webpage loaded successfully");
    console.log("Webpage loaded successfully");

    console.log("Logging in...");
    progressBar.progress(10, "Realizando login...");
    await page.fill("#email", process.env.LOGIN);
    await page.fill("#password", process.env.PASSWORD);
    await page.click("#btnEntrar");
    logger.info("Logged in successfully");
    console.log("Logged in successfully");

    await page.waitForLoadState("networkidle");
    await page.click("#LeftSideBarContent_liMenuExportacao");
    progressBar.progress(20, "Filtrando notas conferidas...");
    await page.click("#btFiltro");
    await page.click("#ckFiltroDisponivelExportacaoSim");
    await page.click("#btAplicaFiltro");

    console.log("Filtered successfully");
    progressBar.progress(30, "Escolhendo a competência...");
    await page.click("#datePickerDashboard");
    await page.click(
      `//span[contains(@class, 'month') and contains(text(), '${monthAbbreviated}')]`
    );
    logger.info("Filtered successfully");

    const selectPage = await page.$$(
      "//ul[contains(@class, 'pagination')] //a[contains(text(), '1')]"
    );
    await selectPage[0].click();
    logger.info("Filtered successfully");

    const footer = await page.textContent(
      "//div[contains(@class, 'panel-footer')] //div[contains(@class, 'mb5')]"
    );
    const numberOfDownloads = parseInt(footer.split()[7]);
    logger.info(`Number of downloads: ${numberOfDownloads}`);

    let failsafe = 1;
    const exportDownloadButton =
      'xpath=//*[contains(text(), "Sim, pode exportar!")]';
    const competencia = `${monthInDigits}${year}`;

    for (let arquivo = 0; arquivo < numberOfDownloads; arquivo++) {
      progressBar.progress(
        (arquivo / numberOfDownloads) * 100,
        `${arquivo + 1} de ${numberOfDownloads} arquivos baixados. Aguarde...`
      );

      await page.click(
        `//*[@id="tabServicosPorEmpresa"]/tbody/tr[${failsafe}]/td[14]`
      );
      if (!(await page.isVisible(exportDownloadButton))) {
        failsafe++;
        continue;
      }

      const download = await page.waitForEvent("download", async () => {
        await page.click(exportDownloadButton);
        try {
          await page.click('//*[contains(text(), "Exportar parcialmente!")]', {
            timeout: 5000,
          });
        } catch {}
      });

      const fileName = download.suggestedFilename();
      logger.info("Downloaded the file successfully");
      console.log("Downloaded the file successfully");

      // Simulating database query and directory creation for simplicity
      const idEmp = "exampleId";
      const empName = "exampleName";
      const downloadPath = path.join(
        "Z:\\FISCAL\\Importação\\Tomados",
        `${idEmp}-${empName}`,
        competencia
      );

      if (!(await fs.pathExists(downloadPath))) {
        await fs.mkdirp(downloadPath);
      }

      await download.saveAs(path.join(downloadPath, fileName));
      await writeTxt(`${idEmp} - Arquivo baixado`);
      logger.info("File saved successfully");
      console.log("File saved successfully");
    }
  } catch (e) {
    logger.error(`Failed at some step - ERROR: ${e}`);
    console.error(`Failed at some step - ERROR: ${e}`);
  } finally {
    await browser.close();
    console.log("Browser closed");
  }
}

// Example usage
const progressBar = {
  progress: (value, text) => console.log(`Progress: ${value}% - ${text}`),
};

uneAutomation("May", "05", "2023", progressBar);
