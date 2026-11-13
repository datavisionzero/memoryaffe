import { test, expect } from "@playwright/test";

test("Setup erklärt Passwortgrenzen vor dem Absenden und zählt Unicodezeichen", async ({ page }) => {
  // Expose the initial-setup screen even when the shared E2E database is initialized.
  await page.route("**/api/v1/me", route => route.fulfill({ status: 401, json: { code: "authentication_required" } }));
  await page.route("**/api/v1/setup", route => route.request().method() === "GET"
    ? route.fulfill({ json: { setupRequired: true } }) : route.continue());
  let writes = 0;
  page.on("request", request => { if (request.method() === "POST") writes++; });
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("invalid-setup@example.test");
  await page.getByLabel("Betreibersecret").fill("synthetic-setup-secret-not-submitted");
  const password = page.getByLabel("Passwort", { exact: true });
  await expect(page.getByText("Verwende 15 bis 128 Zeichen.", { exact: true })).toBeVisible();
  for (const invalid of ["short", "😀".repeat(8), "😀".repeat(14), "😀".repeat(129)]) {
    await password.fill(invalid);
    await page.getByRole("button", { name: "Konto erstellen" }).click();
    await expect(page.getByRole("alert")).toHaveText("Passwort: Verwende 15 bis 128 Zeichen.");
    await expect(password).toHaveAttribute("aria-invalid", "true");
  }
  for (const valid of ["😀".repeat(15), "😀".repeat(128)]) {
    await password.fill(valid);
    expect(await password.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);
    await expect(password).toHaveValue(valid);
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  expect(writes).toBe(0);
});

for (const path of ["/invite", "/reset-password", "/recover-account"]) {
  test(`${path}: Passwortregeln und Rückweg zur Anmeldung ohne veralteten Token`, async ({ page }) => {
    await page.goto(path + "#token=synthetic-token");
    await expect(page).not.toHaveURL(/#/);
    const password = page.getByLabel("Neues Passwort (mindestens 15 Zeichen)", { exact: true });
    await password.fill("😀".repeat(8));
    await page.getByRole("button", { name: path === "/invite" ? "Einladung annehmen" : "Fortfahren", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Passwort: Verwende 15 bis 128 Zeichen.");
    await page.getByRole("button", { name: "Zur Anmeldung", exact: true }).click();
    await expect(page.getByLabel("E-Mail-Adresse", { exact: true })).toBeVisible();
    const loginPassword = page.getByLabel("Passwort", { exact: true });
    await expect(loginPassword).toHaveValue("");
    await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(`unknown-auth-${crypto.randomUUID()}@example.test`);
    await loginPassword.fill("short");
    const response = page.waitForResponse(r => r.url().endsWith("/api/v1/auth/login"));
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    expect((await response).status()).toBe(401);
    await expect(page.getByRole("alert")).toHaveText("Anmeldung fehlgeschlagen.");
    await page.goBack();
    await expect(page.getByLabel(path === "/invite" ? "Einladungstoken" : "E-Mail-Adresse", { exact: true })).toBeVisible();
  });
}
