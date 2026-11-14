import { test, expect, type Page } from "@playwright/test";

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("Anmeldung: Light und Dark wechseln auch mobile Primärfarben", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  for (const [theme, name] of [["light", "Light"], ["dark", "Dark"]]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect.poll(() => page.locator(".auth-card .primary").evaluate(button => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--primary)";
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return getComputedStyle(button).backgroundColor === expected;
    })).toBe(true);
    await fitsViewport(page);
    await page.screenshot({ path: testInfo.outputPath(`login-${theme}.png`), fullPage: true });
  }
});

test("Systemfarbschema folgt Betriebssystemwechsel auch im Editor", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(process.env.E2E_EMAIL || "browser-test@example.test");
  await page.getByLabel("Passwort", { exact: true }).fill(process.env.E2E_PASSWORD || "Browser-Test-Password-2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.locator(".top-right").getByRole("button", { name: "Profil", exact: true }).click();
  await page.getByLabel("Farbschema", { exact: true }).selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await page.getByRole("button", { name: "Neue Erinnerung", exact: true }).click();
  await expect(page.locator(".cm-editor")).toBeVisible();
  const colors = () => page.evaluate(() => ({
    page: getComputedStyle(document.documentElement).backgroundColor,
    editor: getComputedStyle(document.querySelector(".cm-editor")!).backgroundColor,
  }));
  const light = await colors();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(async () => (await colors()).page).not.toBe(light.page);
  await expect.poll(async () => (await colors()).editor).not.toBe(light.editor);
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(colors).toEqual(light);
});

for (const width of [390, 1440, 1920]) {
  for (const theme of ["dark", "light"]) {
    test(`Gestaltung ${theme} ${width}: Navigation, langer Inhalt und Editor`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto("/login");
      await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(process.env.E2E_EMAIL || "browser-test@example.test");
      await page.getByLabel("Passwort", { exact: true }).fill(process.env.E2E_PASSWORD || "Browser-Test-Password-2026!");
      await page.getByRole("button", { name: "Anmelden", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Suche" })).toBeVisible();
      await page.locator(".top-right").getByRole("button", { name: "Profil", exact: true }).click();
      await page.getByLabel("Farbschema", { exact: true }).selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await fitsViewport(page);
      await page.screenshot({ path: testInfo.outputPath("profile.png"), fullPage: true });

      const navigate = async (name: string) => {
        if (width === 390) await page.getByRole("button", { name: "Navigation öffnen", exact: true }).click();
        await page.getByRole("button", { name, exact: true }).click();
      };
      await navigate("Suche");
      await page.getByLabel("Erinnerungen durchsuchen", { exact: true }).fill("");
      await fitsViewport(page);
      await page.screenshot({ path: testInfo.outputPath("search.png"), fullPage: true });

      if (width === 390) {
        const menu = page.getByRole("button", { name: "Navigation öffnen", exact: true });
        await menu.click();
        const drawer = page.getByRole("dialog", { name: "Navigation", exact: true });
        await expect(drawer).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(drawer).toHaveCount(0);
        await expect(menu).toBeFocused();
      }

      await page.getByRole("button", { name: "Neue Erinnerung", exact: true }).click();
      const title = `Design ${theme} ${width} ${Date.now()} ` + "Wissensspeicher".repeat(10);
      const markdown = "# Lesbares Wissen\n\nEin **wichtiger** Gedanke.\n\n" + "LangesWort".repeat(80) + "\n\n```text\n" + "code".repeat(200) + "\n```\n\n| Spalte | Inhalt |\n| --- | --- |\n| Lang | " + "Tabelleninhalt".repeat(50) + " |";
      await page.getByLabel("Titel", { exact: true }).fill(title);
      await page.getByLabel("Zusammenfassung (optional)").fill("Zusammenfassung ".repeat(20));
      await page.locator(".cm-content").fill(markdown);
      await expect(page.locator(".editor-source")).toBeVisible();
      await fitsViewport(page);
      await page.screenshot({ path: testInfo.outputPath("editor.png"), fullPage: true });
      if (width === 390) {
        await page.getByRole("button", { name: "Vorschau", exact: true }).click();
        await expect(page.locator(".editor-source")).toBeHidden();
        await expect(page.locator(".editor-preview")).toBeVisible();
        await fitsViewport(page);
        await page.getByRole("button", { name: "Markdown bearbeiten", exact: true }).click();
        expect(await page.locator(".cm-line").allTextContents()).toEqual(markdown.split("\n"));
      } else {
        await expect(page.locator(".editor-preview")).toBeVisible();
      }
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(page.locator(".reading strong")).toHaveText("wichtiger");
      await fitsViewport(page);
      await page.screenshot({ path: testInfo.outputPath("reading.png"), fullPage: true });
    });
  }
}
