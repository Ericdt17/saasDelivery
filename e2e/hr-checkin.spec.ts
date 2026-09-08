import { test, expect, type Page } from "@playwright/test";

const OFFICE = { latitude: 3.8721, longitude: 11.5137 };
const FAR = { latitude: 3.8821, longitude: 11.5137 };

async function mockVerifyOk(page: Page) {
  await page.route("**/api/v1/hr/checkin/verify-email**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          full_name: "Jean Dupont",
          email: "jean.dupont@example.com",
          is_enrolled: true,
        },
      }),
    });
  });
}

async function mockVerifyNotEnrolled(page: Page) {
  await page.route("**/api/v1/hr/checkin/verify-email**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          full_name: "Jean Dupont",
          email: "jean.dupont@example.com",
          is_enrolled: false,
        },
      }),
    });
  });
}

async function mockSelfEnrollOk(page: Page) {
  await page.route("**/api/v1/hr/checkin/enroll", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          full_name: "Jean Dupont",
          email: "jean.dupont@example.com",
          is_enrolled: true,
        },
      }),
    });
  });
}

async function mockVerifyNotFound(page: Page) {
  await page.route("**/api/v1/hr/checkin/verify-email**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "Cet e-mail n'est pas enregistré. Vérifiez l'orthographe ou demandez de l'aide aux ressources humaines.",
      }),
    });
  });
}

async function mockCheckinOk(page: Page) {
  await page.route("**/api/v1/hr/checkin", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        employee_name: "Jean Dupont",
        check_in_time: "2026-09-08T07:05:00.000Z",
        status: "present",
      }),
    });
  });
}

async function mockCheckinOutOfRange(page: Page) {
  await page.route("**/api/v1/hr/checkin", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "Vous n'êtes pas au bureau. Rapprochez-vous du site pour pouvoir pointer.",
      }),
    });
  });
}

async function gotoWithGeo(page: Page, coords: { latitude: number; longitude: number }) {
  await page.addInitScript((c) => {
    const position = {
      coords: {
        latitude: c.latitude,
        longitude: c.longitude,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success(position as GeolocationPosition);
        },
        watchPosition: () => 0,
        clearWatch: () => undefined,
      },
    });
  }, coords);
  await page.goto("/?e2e=1");
}

test.describe("hr-app check-in", () => {
  test("email invalide shows error and stays on email step", async ({ page }) => {
    await mockVerifyNotFound(page);
    await page.goto("/?e2e=1");
    await page.getByTestId("email-input").fill("unknown@example.com");
    await page.getByTestId("email-continue").click();
    await expect(page.getByTestId("email-error")).toBeVisible();
    await expect(page.getByTestId("email-input")).toBeVisible();
    await expect(page.getByTestId("face-validate")).toHaveCount(0);
  });

  test("email OK goes to face step", async ({ page }) => {
    await mockVerifyOk(page);
    await page.goto("/?e2e=1");
    await page.getByTestId("email-input").fill("jean.dupont@example.com");
    await page.getByTestId("email-continue").click();
    await expect(page.getByTestId("face-validate")).toBeVisible();
    await expect(page.getByText("Jean Dupont")).toBeVisible();
  });

  test("GPS out of range shows bureau message", async ({ page }) => {
    await mockVerifyOk(page);
    await mockCheckinOutOfRange(page);
    await gotoWithGeo(page, FAR);
    await page.getByTestId("email-input").fill("jean.dupont@example.com");
    await page.getByTestId("email-continue").click();
    await page.getByTestId("face-e2e-simulate").click();
    await page.getByTestId("face-validate").click();
    await expect(page.getByTestId("result-message")).toContainText("pas au bureau");
  });

  test("first connection enrolls face then checks in", async ({ page }) => {
    await mockVerifyNotEnrolled(page);
    await mockSelfEnrollOk(page);
    await mockCheckinOk(page);
    await gotoWithGeo(page, OFFICE);
    await page.getByTestId("email-input").fill("jean.dupont@example.com");
    await page.getByTestId("email-continue").click();
    await expect(page.getByText("Enregistrez votre visage")).toBeVisible();
    await page.getByTestId("face-e2e-simulate").click();
    await page.getByTestId("face-validate").click();
    await expect(page.getByTestId("result-title")).toContainText("Bonne journée");
  });

  test("happy path shows confirmation", async ({ page }) => {
    await mockVerifyOk(page);
    await mockCheckinOk(page);
    await gotoWithGeo(page, OFFICE);
    await page.getByTestId("email-input").fill("jean.dupont@example.com");
    await page.getByTestId("email-continue").click();
    await page.getByTestId("face-e2e-simulate").click();
    await page.getByTestId("face-validate").click();
    await expect(page.getByTestId("result-title")).toContainText("Bonne journée");
    await expect(page.getByTestId("result-name")).toHaveText("Jean Dupont");
    await expect(page.getByTestId("result-status")).toHaveText("Présent");
  });
});
