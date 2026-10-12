import { test, beforeEach, afterEach, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { openDatabase, findSleep } from "../src/db.ts";
import { getMadridToday } from "../src/sleepCalendar.ts";
import { validateNewSleep, validateSleepUpdate } from "../src/validation.ts";

const NOW = new Date("2026-10-12T10:00:00Z");
const FUTURE_MESSAGE = "No puedes registrar horas de sueño para una fecha futura.";
const valid = { sleepDate: "2026-10-12", hoursSlept: 7, sleepType: "night" };
let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;

beforeEach((context) => {
  (context as TestContext).mock.timers.enable({ apis: ["Date"], now: NOW });
  db = openDatabase(":memory:");
  app = createApp({ db, demoUserId: "owner", corsOrigin: "http://localhost:5173" });
});

afterEach(() => {
  db.close();
});

for (const sleepType of ["night", "nap", "other"]) {
  test(`POST guarda y devuelve el tipo ${sleepType}`, async () => {
    const res = await request(app).post("/api/sleep").send({ ...valid, sleepType });
    assert.equal(res.status, 201);
    assert.equal(res.body.sleepType, sleepType);
    assert.equal(findSleep(db, res.body.id, "owner")!.sleep_type, sleepType);
    assert.deepEqual((await request(app).get("/api/sleep")).body, [res.body]);
  });
}

test("POST permite clientes antiguos con tipo omitido, sin asignarles una categoría ficticia", async () => {
  const res = await request(app).post("/api/sleep").send({ sleepDate: valid.sleepDate, hoursSlept: 8 });
  assert.equal(res.status, 201);
  assert.equal(res.body.sleepType, null);
  assert.equal(findSleep(db, res.body.id, "owner")!.sleep_type, null);
});

test("POST rechaza tipos desconocidos, null explícito y valores que no son texto sin guardar", async () => {
  for (const sleepType of [null, "", "Night", " nap ", "unknown", 1, false, [], {}, "nap'); DROP TABLE activities; --"]) {
    const res = await request(app).post("/api/sleep").send({ ...valid, sleepType });
    assert.equal(res.status, 400, `tipo: ${JSON.stringify(sleepType)}`);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  assert.deepEqual((await request(app).get("/api/sleep")).body, []);
  assert.deepEqual((await request(app).get("/api/activities")).body, []);
});

test("permite varias siestas y totales superiores a 24 horas sin fusionar registros", async () => {
  const first = await request(app).post("/api/sleep").send({ ...valid, sleepType: "nap", hoursSlept: 24 });
  const second = await request(app).post("/api/sleep").send({ ...valid, sleepType: "nap", hoursSlept: 8 });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(first.body.id, second.body.id);
  const listed = await request(app).get("/api/sleep");
  assert.equal(listed.body.length, 2);
  assert.equal(listed.body.reduce((sum: number, record: { hoursSlept: number }) => sum + record.hoursSlept, 0), 32);
});

test("POST acepta hoy y el pasado en Madrid y rechaza mañana sin insertar", async () => {
  for (const sleepDate of ["2026-10-12", "2026-10-11"]) {
    assert.equal((await request(app).post("/api/sleep").send({ ...valid, sleepDate })).status, 201);
  }
  const res = await request(app).post("/api/sleep").send({ ...valid, sleepDate: "2026-10-13" });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: { code: "VALIDATION_ERROR", message: FUTURE_MESSAGE } });
  assert.equal((await request(app).get("/api/sleep")).body.length, 2);
});

test("PATCH modifica fecha, horas y tipo conservando id, createdAt, usuario y número de filas", async () => {
  const original = await request(app).post("/api/sleep").send(valid);
  const res = await request(app).patch(`/api/sleep/${original.body.id}`).send({
    sleepDate: "2026-10-11", hoursSlept: 1.5, sleepType: "nap",
    id: 900, createdAt: "2000-01-01T00:00:00Z", userId: "attacker",
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    id: original.body.id, sleepDate: "2026-10-11", hoursSlept: 1.5,
    sleepType: "nap", createdAt: original.body.createdAt,
  });
  assert.equal(findSleep(db, original.body.id, "owner")!.user_id, "owner");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sleep_records").get()!.count, 1);
  assert.deepEqual((await request(app).get("/api/sleep")).body, [res.body]);
});

test("PATCH puede clasificar un registro histórico sin tipo", async () => {
  const original = await request(app).post("/api/sleep").send({ sleepDate: valid.sleepDate, hoursSlept: 7 });
  assert.equal(original.body.sleepType, null);
  const edited = await request(app).patch(`/api/sleep/${original.body.id}`).send({ ...valid, sleepType: "other" });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.sleepType, "other");
  assert.equal(edited.body.id, original.body.id);
  assert.equal(edited.body.createdAt, original.body.createdAt);
});

test("PATCH idéntico sigue devolviendo el registro existente sin insertar otro", async () => {
  const original = await request(app).post("/api/sleep").send(valid);
  const edited = await request(app).patch(`/api/sleep/${original.body.id}`).send(valid);
  assert.equal(edited.status, 200);
  assert.deepEqual(edited.body, original.body);
  assert.equal((await request(app).get("/api/sleep")).body.length, 1);
});

test("PATCH valida los tres campos completos y no altera el registro si falla", async () => {
  const original = await request(app).post("/api/sleep").send(valid);
  const invalidBodies = [
    {}, { sleepDate: valid.sleepDate, hoursSlept: 8 },
    { sleepDate: valid.sleepDate, sleepType: "nap" },
    { hoursSlept: 8, sleepType: "nap" },
    ...[null, "", "invalid", true, 9, {}].map((sleepType) => ({ ...valid, sleepType })),
    ...[0, -1, 24.01, "8", true, null].map((hoursSlept) => ({ ...valid, hoursSlept })),
    ...["2026-02-30", "2026-2-01", "2026-10-11\n", "2026-10-13"].map((sleepDate) => ({ ...valid, sleepDate })),
  ];
  for (const body of invalidBodies) {
    const res = await request(app).patch(`/api/sleep/${original.body.id}`).send(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.deepEqual((await request(app).get("/api/sleep")).body, [original.body]);
  }
  for (const hoursSlept of [NaN, Infinity, -Infinity]) {
    assert.equal(validateSleepUpdate({ ...valid, hoursSlept }, NOW).ok, false);
  }
});

test("PATCH rechaza mañana con el mensaje acordado y permite hoy", async () => {
  const original = await request(app).post("/api/sleep").send({ ...valid, sleepDate: "2026-10-11" });
  const future = await request(app).patch(`/api/sleep/${original.body.id}`).send({ ...valid, sleepDate: "2026-10-13" });
  assert.equal(future.status, 400);
  assert.equal(future.body.error.message, FUTURE_MESSAGE);
  const today = await request(app).patch(`/api/sleep/${original.body.id}`).send(valid);
  assert.equal(today.status, 200);
  assert.equal(today.body.sleepDate, "2026-10-12");
});

test("PATCH rechaza identificadores no canónicos, inseguros o no positivos", async () => {
  for (const id of ["0", "-1", "1.5", "abc", "01", "+1", "1e0", "1\n", "9007199254740992", "1 OR 1=1"]) {
    const res = await request(app).patch(`/api/sleep/${encodeURIComponent(id)}`).send(valid);
    assert.equal(res.status, 400, id);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  assert.deepEqual((await request(app).get("/api/sleep")).body, []);
});

test("PATCH devuelve el mismo 404 para registros inexistentes y de otro usuario", async () => {
  const foreignApp = createApp({ db, demoUserId: "another-owner", corsOrigin: "http://localhost:5173" });
  const foreign = await request(foreignApp).post("/api/sleep").send(valid);
  const missing = await request(app).patch("/api/sleep/9999").send(valid);
  const forbidden = await request(app).patch(`/api/sleep/${foreign.body.id}`).send({ ...valid, userId: "another-owner" });
  assert.equal(missing.status, 404);
  assert.equal(forbidden.status, 404);
  assert.deepEqual(missing.body, forbidden.body);
  assert.equal(forbidden.body.error.code, "NOT_FOUND");
  assert.deepEqual((await request(foreignApp).get("/api/sleep")).body, [foreign.body]);
  assert.deepEqual((await request(app).get("/api/sleep")).body, []);
});

test("PATCH mantiene errores JSON 400 y tamaño 413 sin realizar cambios", async () => {
  const original = await request(app).post("/api/sleep").send(valid);
  const malformed = await request(app).patch(`/api/sleep/${original.body.id}`)
    .set("Content-Type", "application/json").send("{ malformed");
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, "VALIDATION_ERROR");
  const oversized = await request(app).patch(`/api/sleep/${original.body.id}`).send({ ...valid, extra: "x".repeat(11_000) });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error.code, "PAYLOAD_TOO_LARGE");
  assert.deepEqual((await request(app).get("/api/sleep")).body, [original.body]);
});

test("CORS permite PATCH con Content-Type en el origen configurado", async () => {
  const response = await request(app).options("/api/sleep/1")
    .set("Origin", "http://localhost:5173")
    .set("Access-Control-Request-Method", "PATCH")
    .set("Access-Control-Request-Headers", "Content-Type");
  assert.equal(response.status, 204);
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5173");
  assert.match(response.headers["access-control-allow-methods"], /PATCH/);
});

test("el calendario Madrid es independiente de medianoche UTC y de los cambios de horario", () => {
  const cases = [
    ["2026-01-01T22:59:59.999Z", "2026-01-01"],
    ["2026-01-01T23:00:00.000Z", "2026-01-02"],
    ["2026-07-01T21:59:59.999Z", "2026-07-01"],
    ["2026-07-01T22:00:00.000Z", "2026-07-02"],
    ["2026-03-28T23:00:00.000Z", "2026-03-29"],
    ["2026-03-29T00:59:59.999Z", "2026-03-29"],
    ["2026-03-29T01:00:00.000Z", "2026-03-29"],
    ["2026-03-29T22:00:00.000Z", "2026-03-30"],
    ["2026-10-24T22:00:00.000Z", "2026-10-25"],
    ["2026-10-25T00:59:59.999Z", "2026-10-25"],
    ["2026-10-25T01:00:00.000Z", "2026-10-25"],
    ["2026-10-25T22:59:59.999Z", "2026-10-25"],
    ["2026-10-25T23:00:00.000Z", "2026-10-26"],
  ];
  for (const [instant, expected] of cases) {
    assert.equal(getMadridToday(new Date(instant)), expected, instant);
    assert.equal(validateNewSleep({ ...valid, sleepDate: expected }, new Date(instant)).ok, true);
    assert.equal(validateSleepUpdate({ ...valid, sleepDate: expected }, new Date(instant)).ok, true);
  }
});

test("POST y PATCH pasan a aceptar el nuevo día exactamente a medianoche Madrid", async (context) => {
  const original = await request(app).post("/api/sleep").send({ ...valid, sleepDate: "2026-07-01" });
  context.mock.timers.setTime(new Date("2026-07-01T21:59:59.999Z").getTime());
  const nextDay = { ...valid, sleepDate: "2026-07-02" };
  assert.equal((await request(app).post("/api/sleep").send(nextDay)).status, 400);
  assert.equal((await request(app).patch(`/api/sleep/${original.body.id}`).send(nextDay)).status, 400);
  context.mock.timers.setTime(new Date("2026-07-01T22:00:00.000Z").getTime());
  assert.equal((await request(app).post("/api/sleep").send(nextDay)).status, 201);
  assert.equal((await request(app).patch(`/api/sleep/${original.body.id}`).send(nextDay)).status, 200);
});

test("la migración conserva sueño legacy y HU1, se puede reabrir y mantiene las ediciones", async () => {
  const directory = mkdtempSync(join(tmpdir(), "healthy-life-sleep-types-"));
  const path = join(directory, "legacy.db");
  let persistent: DatabaseSync | undefined;
  try {
    persistent = new DatabaseSync(path);
    persistent.exec(`
      CREATE TABLE activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
        activity_type TEXT NOT NULL, activity_date TEXT NOT NULL,
        notes TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE sleep_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
        sleep_date TEXT NOT NULL, hours_slept REAL NOT NULL, created_at TEXT NOT NULL
      );
    `);
    persistent.prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)")
      .run(8, "owner", "walking", "2026-10-10", "HU1 intacta", "2026-10-10T10:00:00.000Z");
    const legacyInsert = persistent.prepare("INSERT INTO sleep_records VALUES (?, ?, ?, ?, ?)");
    legacyInsert.run(11, "owner", "2026-10-10", 8, "2026-10-10T10:00:00.000Z");
    legacyInsert.run(12, "owner", "2099-12-31", 7.5, "2026-10-10T11:00:00.000Z");
    const activityRows = persistent.prepare("SELECT * FROM activities").all();
    const activitySchema = persistent.prepare("SELECT sql FROM sqlite_master WHERE name = 'activities'").get()!.sql;
    const activitySequence = persistent.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'activities'").get()!.seq;
    const legacyRows = persistent.prepare("SELECT * FROM sleep_records ORDER BY id").all();
    persistent.close();
    persistent = undefined;

    for (let opening = 0; opening < 2; opening += 1) {
      persistent = openDatabase(path);
      assert.deepEqual(persistent.prepare("SELECT * FROM activities").all(), activityRows);
      assert.equal(persistent.prepare("SELECT sql FROM sqlite_master WHERE name = 'activities'").get()!.sql, activitySchema);
      assert.equal(persistent.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'activities'").get()!.seq, activitySequence);
      assert.deepEqual(
        persistent.prepare("SELECT id, user_id, sleep_date, hours_slept, created_at FROM sleep_records ORDER BY id").all(),
        legacyRows,
      );
      assert.equal(persistent.prepare("PRAGMA table_info(sleep_records)").all().filter((column) => column.name === "sleep_type").length, 1);
      assert.equal(persistent.prepare("SELECT COUNT(*) AS count FROM sleep_records WHERE sleep_type IS NULL").get()!.count, 2);
      persistent.close();
      persistent = undefined;
    }

    persistent = openDatabase(path);
    const migratedApp = createApp({ db: persistent, demoUserId: "owner", corsOrigin: "http://localhost:5173" });
    const listed = await request(migratedApp).get("/api/sleep");
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.map((row: { id: number; sleepType: null }) => [row.id, row.sleepType]), [[12, null], [11, null]]);
    assert.equal(listed.body[0].sleepDate, "2099-12-31");
    const futureEdit = await request(migratedApp).patch("/api/sleep/12").send({ ...valid, sleepDate: "2099-12-31" });
    assert.equal(futureEdit.status, 400);
    assert.equal(findSleep(persistent, 12, "owner")!.sleep_date, "2099-12-31");
    const edited = await request(migratedApp).patch("/api/sleep/12").send({ ...valid, sleepType: "nap", hoursSlept: 1.5 });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.id, 12);
    assert.equal(edited.body.createdAt, "2026-10-10T11:00:00.000Z");
    const created = await request(migratedApp).post("/api/sleep").send(valid);
    assert.equal(created.status, 201);
    assert.equal(created.body.id, 13);
    persistent.close();
    persistent = undefined;

    persistent = openDatabase(path);
    const reopenedApp = createApp({ db: persistent, demoUserId: "owner", corsOrigin: "http://localhost:5173" });
    const reopened = await request(reopenedApp).get("/api/sleep");
    assert.equal(reopened.body.length, 3);
    assert.deepEqual(reopened.body.find((row: { id: number }) => row.id === 12), edited.body);
    assert.deepEqual(reopened.body.find((row: { id: number }) => row.id === 13), created.body);
    assert.deepEqual(persistent.prepare("SELECT * FROM activities").all(), activityRows);
  } finally {
    persistent?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
