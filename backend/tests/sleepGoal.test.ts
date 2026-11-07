// Pruebas de HU10 — Objetivo mínimo de horas de sueño.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";
import { getMadridToday } from "../src/sleepCalendar.ts";
import { buildSleepGoalSummary, shiftDate } from "../src/sleepGoal.ts";

let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({ db, demoUserId: "test-user", corsOrigin: "http://localhost:5173" });
});
afterEach(() => db.close());

const today = () => getMadridToday();

async function sleep(sleepDate: string, hoursSlept: number, sleepType = "night") {
  const response = await request(app).post("/api/sleep").send({ sleepDate, hoursSlept, sleepType });
  assert.equal(response.status, 201);
}

test("sin objetivo ni registros devuelve un resumen vacío y sin aviso", async () => {
  const response = await request(app).get("/api/sleep-goal");
  assert.equal(response.status, 200);
  assert.equal(response.body.minHours, null);
  assert.equal(response.body.updatedAt, null);
  assert.deepEqual(response.body.days, []);
  assert.equal(response.body.latest, null);
  assert.equal(response.body.alert, false);
  assert.equal(response.body.toDate, today());
  assert.equal(response.body.fromDate, shiftDate(today(), -6));
});

test("guarda el objetivo (admite decimales) y lo sustituye al cambiarlo", async () => {
  const first = await request(app).put("/api/sleep-goal").send({ minHours: 8 });
  assert.equal(first.status, 200);
  assert.equal(first.body.minHours, 8);
  assert.ok(!Number.isNaN(Date.parse(first.body.updatedAt)));

  const second = await request(app).put("/api/sleep-goal").send({ minHours: 7.5 });
  assert.equal(second.status, 200);
  assert.equal((await request(app).get("/api/sleep-goal")).body.minHours, 7.5);
  const rows = db.prepare("SELECT COUNT(*) AS n FROM sleep_goals").get() as { n: number };
  assert.equal(rows.n, 1);
});

test("rechaza valores fuera de rango, vacíos o no numéricos y conserva el anterior", async () => {
  await request(app).put("/api/sleep-goal").send({ minHours: 8 });
  for (const minHours of [undefined, null, 0, -1, 24.5, 25, "8", "", {}, true, Number.NaN]) {
    const response = await request(app).put("/api/sleep-goal").send({ minHours });
    assert.equal(response.status, 400, String(minHours));
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  }
  const malformed = await request(app)
    .put("/api/sleep-goal")
    .set("Content-Type", "application/json")
    .send("{ no es json");
  assert.equal(malformed.status, 400);
  assert.equal((await request(app).get("/api/sleep-goal")).body.minHours, 8);
});

test("admite exactamente 24 horas", async () => {
  const response = await request(app).put("/api/sleep-goal").send({ minHours: 24 });
  assert.equal(response.status, 200);
  assert.equal(response.body.minHours, 24);
});

test("avisa cuando el último día registrado no alcanza el objetivo (suma noche y siesta)", async () => {
  await request(app).put("/api/sleep-goal").send({ minHours: 8 });
  await sleep(today(), 6);
  await sleep(today(), 1, "nap");

  const response = await request(app).get("/api/sleep-goal");
  assert.equal(response.body.alert, true);
  assert.deepEqual(response.body.latest, { date: today(), totalHours: 7, met: false });
});

test("no avisa cuando el último día registrado alcanza el objetivo", async () => {
  await request(app).put("/api/sleep-goal").send({ minHours: 8 });
  await sleep(shiftDate(today(), -1), 5);
  await sleep(today(), 9);

  const response = await request(app).get("/api/sleep-goal");
  assert.equal(response.body.alert, false);
  assert.deepEqual(
    response.body.days.map((day: { date: string; met: boolean }) => [day.date, day.met]),
    [
      [today(), true],
      [shiftDate(today(), -1), false],
    ],
  );
});

test("solo revisa los últimos 7 días y no inventa días sin registros", async () => {
  await request(app).put("/api/sleep-goal").send({ minHours: 8 });
  await sleep(shiftDate(today(), -7), 4);
  await sleep(shiftDate(today(), -2), 6);

  const response = await request(app).get("/api/sleep-goal");
  assert.equal(response.body.days.length, 1);
  assert.equal(response.body.latest.date, shiftDate(today(), -2));
  assert.equal(response.body.alert, true);
});

test("sin objetivo calcula los totales pero no marca cumplimiento ni avisa", async () => {
  await sleep(today(), 5);
  const response = await request(app).get("/api/sleep-goal");
  assert.equal(response.body.latest.totalHours, 5);
  assert.equal(response.body.latest.met, null);
  assert.equal(response.body.alert, false);
});

test("el cálculo usa el día que se le indica como hoy", () => {
  db.prepare("INSERT INTO sleep_goals (user_id, min_hours, updated_at) VALUES (?, ?, ?)").run(
    "test-user",
    8,
    new Date().toISOString(),
  );
  db.prepare(
    "INSERT INTO sleep_records (user_id, sleep_date, hours_slept, created_at, sleep_type) VALUES (?, ?, ?, ?, ?)",
  ).run("test-user", "2026-11-01", 6.1, new Date().toISOString(), "night");
  db.prepare(
    "INSERT INTO sleep_records (user_id, sleep_date, hours_slept, created_at, sleep_type) VALUES (?, ?, ?, ?, ?)",
  ).run("test-user", "2026-11-01", 0.2, new Date().toISOString(), "nap");

  const summary = buildSleepGoalSummary(db, "test-user", "2026-11-03");
  assert.equal(summary.fromDate, "2026-10-28");
  assert.deepEqual(summary.latest, { date: "2026-11-01", totalHours: 6.3, met: false });
});
