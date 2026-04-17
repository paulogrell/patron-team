import { Before, After, Status, setDefaultTimeout } from '@cucumber/cucumber';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closeWorld, launchWorld } from './world.js';

setDefaultTimeout(120 * 1000);

async function ensureArtifactsDir() {
  const dir = path.resolve('bdd', 'artifacts');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

Before(async function () {
  await launchWorld(this);

  await this.page.goto(this.baseUrl);
  await this.page.evaluate(async () => {
    const dbs = await window.indexedDB.databases();
    await Promise.all(
      dbs
        .filter((db) => db?.name)
        .map(
          (db) =>
            new Promise((resolve) => {
              const request = window.indexedDB.deleteDatabase(db.name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            })
        )
    );
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

After(async function (scenario) {
  const failed = scenario.result?.status === Status.FAILED;
  const safeName = scenario.pickle.name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
  const stamp = Date.now();

  if (failed) {
    const dir = await ensureArtifactsDir();
    if (this.page) {
      await this.page.screenshot({
        path: path.join(dir, `${safeName}-${stamp}.png`),
        fullPage: true,
      });
    }
  }

  try {
    const dir = await ensureArtifactsDir();
    if (this.context) {
      await this.context.tracing.stop({
        path: path.join(dir, `${safeName}-${stamp}.zip`),
      });
    }
  } catch {
    // No tracing available for this run.
  }

  await closeWorld(this);
});

Before(async function () {
  await this.context.tracing.start({ screenshots: true, snapshots: true });
});
