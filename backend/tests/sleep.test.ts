// Pruebas de HU2 contra la API real: SQLite en memoria y persistencia temporal.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";
import { validateNewSleep } from "../src/validation.ts";

let app: ReturnType<typeof createApp>;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({ db, demoUserId: "test-user", corsOrigin: "http://localhost:5173" });
});

afterEach(() => {
  db.close();
});

for (const hoursSlept of [8, 7.5, 24]) {
  test(`registra ${hoursSlept} horas de sueño, devuelve 201 y las guarda`, async () => {
    const res = await request(app)
      .post("/api/sleep")
      .send({ sleepDate: "2026-10-10", hoursSlept });

    assert.equal(res.status, 201);
    assert.deepEqual(Object.keys(res.body).sort(), ["createdAt", "hoursSlept", "id", "sleepDate", "sleepType"]);
    assert.equal(res.body.id, 1);
    assert.equal(res.body.sleepDate, "2026-10-10");
    assert.equal(res.body.hoursSlept, hoursSlept);
    assert.equal(res.body.sleepType, null);
    assert.equal(new Date(res.body.createdAt).toISOString(), res.body.createdAt);

    const row = db.prepare("SELECT * FROM sleep_records WHERE id = ?").get(1)!;
    assert.equal(row.user_id, "test-user");
    assert.equal(row.sleep_date, "2026-10-10");
    assert.equal(row.hours_slept, hoursSlept);
    assert.equal(row.created_at, res.body.createdAt);
  });
}

test("acepta decimales sin imponer incrementos de media hora", async () => {
  const res = await request(app)
    .post("/api/sleep")
    .send({ sleepDate: "2026-10-10", hoursSlept: 0.01 });
  assert.equal(res.status, 201);
  assert.equal(res.body.hoursSlept, 0.01);
});

test("rechaza horas ausentes, no numéricas, no finitas o fuera de rango sin escribir", async () => {
  for (const hoursSlept of [0, -1, 24.01, "8", "", true, false, null, undefined, NaN, Infinity, -Infinity]) {
    // JSON convierte NaN e Infinity en null; esta comprobación cubre también el validador directamente.
    const result = validateNewSleep({ sleepDate: "2026-10-10", hoursSlept });
    assert.equal(result.ok, false, `debería rechazar ${String(hoursSlept)}`);

    const res = await request(app)
      .post("/api/sleep")
      .send({ sleepDate: "2026-10-10", hoursSlept });
    assert.equal(res.status, 400, `debería rechazar ${String(hoursSlept)}`);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.equal(res.body.error.message, "Las horas de sueño no son válidas.");
  }
  assert.deepEqual((await request(app).get("/api/sleep")).body, []);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sleep_records").get()!.count, 0);
});

test("rechaza fechas inexistentes, tipos incorrectos y formatos no exactos", async () => {
  for (const sleepDate of [
    "2026-02-30", "2026-02-29", "1900-02-29", "2100-02-29", "2026-04-31",
    "2026-00-10", "2026-13-10", "2026-10-00", "0000-01-01", "2026-1-01",
    "10/10/2026", "2026-10-10T00:00:00Z", "2026-10-10\n", " 2026-10-10",
    "", null, 20261010, true, undefined,
  ]) {
    const res = await request(app)
      .post("/api/sleep")
      .send({ sleepDate, hoursSlept: 8 });
    assert.equal(res.status, 400, `debería rechazar ${String(sleepDate)}`);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.equal(res.body.error.message, "La fecha del sueño no es válida.");
  }
  assert.deepEqual((await request(app).get("/api/sleep")).body, []);
});

test("acepta fechas gregorianas pasadas, bisiestos y años pequeños sin convertirlas", async () => {
  for (const sleepDate of ["0001-01-01", "0099-12-31", "2000-02-29", "2024-02-29"]) {
    const res = await request(app)
      .post("/api/sleep")
      .send({ sleepDate, hoursSlept: 8 });
    assert.equal(res.status, 201, `debería aceptar ${sleepDate}`);
    assert.equal(res.body.sleepDate, sleepDate);
  }
  // El año 9999 sigue siendo calendario válido, pero la nueva regla prohíbe registrarlo en el futuro.
  assert.equal(validateNewSleep({ sleepDate: "9999-12-31", hoursSlept: 8 }, new Date("9999-12-31T12:00:00Z")).ok, true);
  const future = await request(app).post("/api/sleep").send({ sleepDate: "9999-12-31", hoursSlept: 8 });
  assert.equal(future.status, 400);
  assert.equal(future.body.error.message, "No puedes registrar horas de sueño para una fecha futura.");
});

test("rechaza cuerpos que no son objetos JSON y objetos incompletos", async () => {
  for (const body of [null, [], true, 8, "texto"]) {
    assert.equal(validateNewSleep(body).ok, false);
    const res = await request(app)
      .post("/api/sleep")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(body));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  for (const body of [{}, { sleepDate: "2026-10-10" }, { hoursSlept: 8 }]) {
    const res = await request(app).post("/api/sleep").send(body);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  assert.deepEqual((await request(app).get("/api/sleep")).body, []);
});

test("rechaza un JSON mal formado con el formato común de errores", async () => {
  const res = await request(app)
    .post("/api/sleep")
    .set("Content-Type", "application/json")
    .send("{ no es JSON");
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, {
    error: { code: "VALIDATION_ERROR", message: "El cuerpo no es un JSON válido." },
  });
  assert.deepEqual((await request(app).get("/api/sleep")).body, []);
});

test("el listado está vacío antes del primer registro", async () => {
  const res = await request(app).get("/api/sleep");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test("ordena por fecha descendente e id descendente y admite registros del mismo día", async () => {
  const entries = [
    { sleepDate: "2026-10-09", hoursSlept: 7 },
    { sleepDate: "2026-10-11", hoursSlept: 8 },
    { sleepDate: "2026-10-10", hoursSlept: 6.5 },
    { sleepDate: "2026-10-11", hoursSlept: 7.5 },
  ];
  for (const entry of entries) {
    const res = await request(app).post("/api/sleep").send(entry);
    assert.equal(res.status, 201);
  }

  const res = await request(app).get("/api/sleep");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((row: { id: number }) => row.id), [4, 2, 3, 1]);
  assert.deepEqual(res.body.map((row: { hoursSlept: number }) => row.hoursSlept), [7.5, 8, 6.5, 7]);
});

test("asocia el registro al usuario del servidor, ignora userId enviado y aísla los listados", async () => {
  const otherApp = createApp({ db, demoUserId: "other-user", corsOrigin: "http://localhost:5173" });
  const first = await request(app)
    .post("/api/sleep")
    .send({ sleepDate: "2026-10-10", hoursSlept: 8, userId: "other-user" });
  const second = await request(otherApp)
    .post("/api/sleep")
    .send({ sleepDate: "2026-10-11", hoursSlept: 7.5, userId: "test-user" });

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(db.prepare("SELECT user_id FROM sleep_records WHERE id = ?").get(first.body.id)!.user_id, "test-user");
  assert.equal(db.prepare("SELECT user_id FROM sleep_records WHERE id = ?").get(second.body.id)!.user_id, "other-user");
  assert.deepEqual((await request(app).get("/api/sleep")).body, [first.body]);
  assert.deepEqual((await request(otherApp).get("/api/sleep")).body, [second.body]);
});

test("persiste el registro de sueño tras cerrar y volver a abrir un fichero SQLite", async () => {
  const directory = mkdtempSync(join(tmpdir(), "healthy-life-sleep-"));
  const path = join(directory, "sleep.db");
  let persistentDb: DatabaseSync | undefined;
  try {
    persistentDb = openDatabase(path);
    const firstApp = createApp({ db: persistentDb, demoUserId: "persistent-user", corsOrigin: "http://localhost:5173" });
    const saved = await request(firstApp)
      .post("/api/sleep")
      .send({ sleepDate: "2026-10-10", hoursSlept: 7.5 });
    assert.equal(saved.status, 201);
    persistentDb.close();
    persistentDb = undefined;

    persistentDb = openDatabase(path);
    const reopenedApp = createApp({ db: persistentDb, demoUserId: "persistent-user", corsOrigin: "http://localhost:5173" });
    const listed = await request(reopenedApp).get("/api/sleep");
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body, [saved.body]);
    assert.equal(persistentDb.prepare("SELECT hours_slept FROM sleep_records WHERE id = ?").get(saved.body.id)!.hours_slept, 7.5);
  } finally {
    persistentDb?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("añade sleep_records a una base HU1 existente sin alterar su tabla ni sus actividades", async () => {
  const directory = mkdtempSync(join(tmpdir(), "healthy-life-sleep-migration-"));
  const path = join(directory, "legacy.db");
  let legacyDb: DatabaseSync | undefined;
  try {
    // Fichero con el esquema original de HU1, sin pasar por openDatabase de HU2.
    legacyDb = new DatabaseSync(path);
    legacyDb.exec(`
      CREATE TABLE activities (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       TEXT    NOT NULL,
        activity_type TEXT    NOT NULL,
        activity_date TEXT    NOT NULL,
        notes         TEXT,
        created_at    TEXT    NOT NULL
      )
    `);
    legacyDb.prepare(`
      INSERT INTO activities (user_id, activity_type, activity_date, notes, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run("legacy-user", "walking", "2026-10-09", "Registro previo de HU1", "2026-10-09T10:30:00.000Z");
    const originalSchema = legacyDb.prepare("SELECT sql FROM sqlite_master WHERE name = 'activities'").get()!.sql;
    const originalRows = legacyDb.prepare("SELECT * FROM activities").all();
    const originalSequence = legacyDb.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'activities'").get()!.seq;
    legacyDb.close();
    legacyDb = undefined;

    legacyDb = openDatabase(path);
    assert.equal(legacyDb.prepare("SELECT sql FROM sqlite_master WHERE name = 'activities'").get()!.sql, originalSchema);
    assert.deepEqual(legacyDb.prepare("SELECT * FROM activities").all(), originalRows);
    assert.equal(legacyDb.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'activities'").get()!.seq, originalSequence);
    assert.equal(legacyDb.prepare("SELECT COUNT(*) AS count FROM sleep_records").get()!.count, 0);

    const migratedApp = createApp({ db: legacyDb, demoUserId: "legacy-user", corsOrigin: "http://localhost:5173" });
    const sleep = await request(migratedApp).post("/api/sleep").send({ sleepDate: "2026-10-10", hoursSlept: 8 });
    assert.equal(sleep.status, 201);
    assert.deepEqual(legacyDb.prepare("SELECT * FROM activities").all(), originalRows);

    const activity = await request(migratedApp)
      .post("/api/activities")
      .send({ activityType: "running", activityDate: "2026-10-10" });
    assert.equal(activity.status, 201);
    assert.equal(activity.body.id, 2);
    assert.equal((await request(migratedApp).get("/api/activities")).body.length, 2);
    assert.equal((await request(migratedApp).get("/api/sleep")).body.length, 1);
  } finally {
    legacyDb?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("permite el origen configurado por CORS en el endpoint de sueño", async () => {
  const res = await request(app)
    .options("/api/sleep")
    .set("Origin", "http://localhost:5173")
    .set("Access-Control-Request-Method", "POST")
    .set("Access-Control-Request-Headers", "Content-Type");
  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
});

test("mantiene el formato común de los errores 404 y 413", async () => {
  const missing = await request(app).get("/api/sleep/no-existe");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "NOT_FOUND");

  const oversized = await request(app)
    .post("/api/sleep")
    .send({ sleepDate: "2026-10-10", hoursSlept: 8, extra: "x".repeat(11_000) });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error.code, "PAYLOAD_TOO_LARGE");
  assert.deepEqual((await request(app).get("/api/sleep")).body, []);
});

test("un fallo de persistencia devuelve 500 sin exponer detalles internos", async (context) => {
  const log = context.mock.method(console, "error", () => {});
  db.exec("DROP TABLE sleep_records");
  const res = await request(app)
    .post("/api/sleep")
    .send({ sleepDate: "2026-10-10", hoursSlept: 8 });
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, {
    error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." },
  });
  assert.equal(log.mock.callCount(), 1);
});
