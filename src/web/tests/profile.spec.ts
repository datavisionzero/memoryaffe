import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page
    .getByLabel("E-Mail-Adresse", { exact: true })
    .fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Passwort", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Suche", exact: true }),
  ).toBeVisible();
}

test("Kontothemen sind getrennt, verlinkbar und mobil erreichbar", async ({
  page,
}, testInfo) => {
  await login(page);
  await expect(
    page.getByRole("button", { name: "Profil", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator(".sidebar .account")).toHaveCount(0);
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Kontoeinstellungen" });
  await expect(nav.getByRole("link")).toHaveCount(6);
  await expect(
    page.locator('.profile-panel input[type="password"]'),
  ).toHaveCount(0);
  await expect(page.getByLabel("Farbschema").locator("option")).toHaveText([
    "Dark",
    "Light",
    "System",
  ]);
  for (const [label, path, passwords] of [
    ["Passwort", "password", 2],
    ["Zwei-Faktor-Schutz", "two-factor", 1],
    ["Sitzungen", "sessions", 0],
    ["Agenteneinstellungen", "agents", 0],
    ["Konto löschen", "delete", 1],
  ] as const) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/app/profile/${path}`));
    await expect(page.locator(".profile-panel > .settings-card")).toHaveCount(
      1,
    );
    await expect(
      page.locator('.profile-panel input[type="password"]'),
    ).toHaveCount(passwords);
    await expect(page.getByLabel("Farbschema")).toHaveCount(0);
  }
  await page
    .getByLabel("Dein Passwort zur Bestätigung")
    .fill("temporary-value");
  await nav.getByRole("link", { name: "Sitzungen", exact: true }).click();
  await page.goBack();
  await expect(page.getByLabel("Dein Passwort zur Bestätigung")).toHaveValue(
    "",
  );
  await page.reload();
  await expect(
    nav.getByRole("link", { name: "Konto löschen", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["light", "dark"]) {
    await nav.getByRole("link", { name: "Darstellung", exact: true }).click();
    await page.getByLabel("Farbschema").selectOption(theme);
    await nav.getByRole("link", { name: "Sitzungen", exact: true }).click();
    await expect(
      page.getByText("Diese Sitzung", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`profile-mobile-${theme}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath("profile-desktop.png"),
    fullPage: true,
  });
  const links = await nav
    .getByRole("link")
    .evaluateAll((elements) =>
      elements.map((el) => el.getBoundingClientRect().top),
    );
  expect(new Set(links).size).toBe(1);
});

test("Autofill unterscheidet Zugangsdaten von Sachfeldern", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByLabel("E-Mail-Adresse", { exact: true }),
  ).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Passwort", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await login(page);
  const search = page.getByRole("searchbox");
  await expect(search).toHaveAttribute("name", "memoryQuery");
  await expect(search).toHaveAttribute("autocomplete", "off");
  await expect(search).toHaveAttribute("data-1p-ignore", "true");
  await page.getByRole("button", { name: "Neuer Vault", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Name", { exact: true }),
  ).toHaveAttribute("name", "resourceName");
  await expect(
    page.getByRole("dialog").getByLabel("Name", { exact: true }),
  ).toHaveAttribute("autocomplete", "off");
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page
    .getByRole("button", { name: "Neue Erinnerung", exact: true })
    .click();
  await expect(page.getByLabel("Titel", { exact: true })).toHaveAttribute(
    "name",
    "memoryTitle",
  );
  await expect(page.getByLabel("Titel", { exact: true })).toHaveAttribute(
    "autocomplete",
    "off",
  );
  await expect(page.getByLabel("Zusammenfassung (optional)")).toHaveAttribute(
    "autocomplete",
    "off",
  );
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await page.getByRole("link", { name: "Passwort", exact: true }).click();
  await expect(
    page.getByLabel("Aktuelles Passwort", { exact: true }),
  ).toHaveAttribute("autocomplete", "current-password");
  await expect(
    page.getByLabel("Neues Passwort (mindestens 15 Zeichen)", { exact: true }),
  ).toHaveAttribute("autocomplete", "new-password");
  await page
    .getByRole("link", { name: "Zwei-Faktor-Schutz", exact: true })
    .click();
  await expect(
    page.getByLabel("Aktuelles Passwort vor dem 2FA-Setup"),
  ).toHaveAttribute("autocomplete", "current-password");
});
