import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:5195/chargraph/";

export default defineConfig({
  testDir: "./e2e",
  reporter: "line",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  }],
  webServer: {
    command: "npm exec vite -- --host 127.0.0.1 --port 5195 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
