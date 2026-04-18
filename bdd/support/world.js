import { setWorldConstructor, World } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';

const defaultBaseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';

class PlaywrightWorld extends World {
  constructor(options) {
    super(options);
    this.browser = null;
    this.context = null;
    this.page = null;
    this.baseUrl = defaultBaseUrl;
  }
}

setWorldConstructor(PlaywrightWorld);

export async function launchWorld(world) {
  world.browser = await chromium.launch({
    headless: process.env.HEADED ? false : true,
  });
  world.context = await world.browser.newContext();
  world.page = await world.context.newPage();
}

export async function closeWorld(world) {
  await world.context?.close();
  await world.browser?.close();
}
