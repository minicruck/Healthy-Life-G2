import { test, beforeEach, afterEach } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";
import { getTrainingWeek } from "../src/trainingWeek.ts";
import { getMadridToday } from "../src/sleepCalendar.ts";

let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({ db, demoUserId: "test-user", corsOrigin: "http://localhost:5173" });
});
afterEach(() => db.close());

function priorDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

test("sin objetivo, indica que no hay meta y muestra el avance real", async () => {
  const result = await request(app).get("/api/training-goal");
  assert.equal(result.status, 200);
  assert.equal(result.body.daysPerWeek, null);
  assert.equal(result.body.remainingDays, null);
  assert.equal(result.body.completedDays, 0);
  assert.deepEqual(
    [result.body.weekStart, result.body.weekEnd],
    Object.values(getTrainingWeek()),
  );
});

test("guarda y sustituye una meta válida sin afectar las demás funcionalidades", async () => {
  const save = await request(app).put("/api/training-goal").send({ daysPerWeek: 3 });
  assert.equal(save.status, 200);
  assert.equal(save.body.daysPerWeek, 3);
  assert.equal(save.body.remainingDays, 3);
  assert.ok(!Number.isNaN(Date.parse(save.body.updatedAt)));

  const changed = await request(app).put("/api/training-goal").send({ daysPerWeek: 5 });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.daysPerWeek, 5);
  assert.equal((await request(app).get("/api/training-goal")).body.daysPerWeek, 5);
  assert.deepEqual((await request(app).get("/api/health")).body, { status: "ok" });
});

test("solo admite enteros entre 1 y 7 y conserva el objetivo anterior", async () => {
  await request(app).put("/api/training-goal").send({ daysPerWeek: 4 });
  for (const daysPerWeek of [
    undefined, null, 0, -1, 8, 1.5, "3", {}, true,
  ]) {
    const response = await request(app).put("/api/training-goal").send({ daysPerWeek });
    assert.equal(response.status, 400, String(daysPerWeek));
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  }
  assert.equal((await request(app).get("/api/training-goal")).body.daysPerWeek, 4);
});

test("cuenta días diferentes, ignora actividades futuras o de semanas pasadas", async () => {
  const today = getMadridToday();
  const lastWeek = priorDay(getTrainingWeek(today).weekStart);
  await request(app).put("/api/training-goal").send({ daysPerWeek: 3 });
  for (const [date, note] of [
    [today, "A"], [today, "B"], [lastWeek, "Anterior"],
  ]) {
    const result = await request(app)
      .post("/api/activities")
      .send({ activityType: "walking", activityDate: date, notes: note });
    assert.equal(result.status, 201);
  }
  const result = await request(app).get("/api/training-goal");
  assert.equal(result.body.completedDays, 1);
  assert.equal(result.body.remainingDays, 2);
  assert.equal((await request(app).get("/api/activities")).body.length, 3);
});

test("el progreso se limita a cero días pendientes después de superar la meta", async () => {
  const today = getMadridToday();
  await request(app).put("/api/training-goal").send({ daysPerWeek: 1 });
  await request(app).post("/api/activities").send({
    activityType: "running", activityDate: today,
  });
  const progress = await request(app).get("/api/training-goal");
  assert.equal(progress.body.completedDays, 1);
  assert.equal(progress.body.remainingDays, 0);
});

test("conserva la meta y el progreso al cerrar y reabrir SQLite", async () => {
  const folder = mkdtempSync(join(tmpdir(), "healthy-life-training-"));
  const dbPath = join(folder, "training.db");
  try {
    const persistedDb = openDatabase(dbPath);
    const persistedApp = createApp({
      db: persistedDb,
      demoUserId: "persistent-user",
      corsOrigin: "http://localhost:5173",
    });
    const save = await request(persistedApp)
      .put("/api/training-goal")
      .send({ daysPerWeek: 4 });
    assert.equal(save.status, 200);
    const activity = await request(persistedApp)
      .post("/api/activities")
      .send({ activityType: "gym", activityDate: getMadridToday() });
    assert.equal(activity.status, 201);
    persistedDb.close();

    const reopened = openDatabase(dbPath);
    try {
      const restoredApp = createApp({
        db: reopened,
        demoUserId: "persistent-user",
        corsOrigin: "http://localhost:5173",
      });
      const result = await request(restoredApp).get("/api/training-goal");
      assert.equal(result.status, 200);
      assert.equal(result.body.daysPerWeek, 4);
      assert.equal(result.body.completedDays, 1);
      assert.equal(result.body.remainingDays, 3);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
