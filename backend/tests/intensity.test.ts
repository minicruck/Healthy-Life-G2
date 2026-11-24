// HU4 — Registrar intensidad del entrenamiento (SCRUM-5). Contrato: docs/hu4-api.md
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";

let db: DatabaseSync;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({ db, demoUserId: "test-user", corsOrigin: "http://localhost:5173" });
});

afterEach(() => db.close());

const valid = { activityType: "running", activityDate: "2026-11-20" };

test("CA1: guarda cada nivel de intensidad asociado al entrenamiento", async () => {
  for (const [index, intensity] of ["low", "moderate", "high"].entries()) {
    const res = await request(app).post("/api/activities").send({ ...valid, intensity });
    assert.equal(res.status, 201);
    assert.equal(res.body.intensity, intensity);

    const row = db
      .prepare("SELECT intensity FROM activity_intensity WHERE activity_id = ?")
      .get(res.body.id) as { intensity: string };
    assert.equal(row.intensity, intensity, `fila ${index + 1} guardada en SQLite`);
  }
});

test("CA2: el historial devuelve la intensidad de cada entrenamiento", async () => {
  await request(app).post("/api/activities").send({ ...valid, activityDate: "2026-11-18", intensity: "low" });
  await request(app).post("/api/activities").send({ ...valid, activityDate: "2026-11-19", intensity: "high" });

  const res = await request(app).get("/api/activities");
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((a: { activityDate: string; intensity: string }) => [a.activityDate, a.intensity]),
    [["2026-11-19", "high"], ["2026-11-18", "low"]],
  );
});

for (const [caso, body] of [
  ["sin intensidad", { ...valid }],
  ["intensidad vacía", { ...valid, intensity: "" }],
  ["intensidad null", { ...valid, intensity: null }],
  ["intensidad desconocida", { ...valid, intensity: "extreme" }],
  ["intensidad numérica", { ...valid, intensity: 3 }],
  ["mayúsculas", { ...valid, intensity: "HIGH" }],
] as const) {
  test(`CA3: rechaza ${caso} con 400 y no guarda nada`, async () => {
    const res = await request(app).post("/api/activities").send(body);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.match(res.body.error.message, /intensidad/i);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM activities").get() as { n: number }).n, 0);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM activity_intensity").get() as { n: number }).n, 0);
  });
}

test("la base de datos también impide una intensidad no válida (CHECK)", () => {
  db.prepare(
    "INSERT INTO activities (user_id, activity_type, activity_date, notes, created_at) VALUES ('u', 'gym', '2026-11-20', NULL, '2026-11-20T10:00:00.000Z')",
  ).run();
  assert.throws(() =>
    db.prepare("INSERT INTO activity_intensity (activity_id, intensity) VALUES (1, 'extreme')").run(),
  );
});

test("registros anteriores a HU4 se conservan y devuelven intensity null", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hu4-"));
  const path = join(dir, "legacy.db");
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE TABLE activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
        activity_type TEXT NOT NULL, activity_date TEXT NOT NULL,
        notes TEXT, created_at TEXT NOT NULL
      )
    `);
    legacy
      .prepare("INSERT INTO activities (user_id, activity_type, activity_date, notes, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("owner", "walking", "2026-10-10", "Registro de HU1", "2026-10-10T10:00:00.000Z");
    const schemaBefore = (legacy.prepare("SELECT sql FROM sqlite_master WHERE name = 'activities'").get() as { sql: string }).sql;
    legacy.close();

    const migrated = openDatabase(path);
    const schemaAfter = (migrated.prepare("SELECT sql FROM sqlite_master WHERE name = 'activities'").get() as { sql: string }).sql;
    assert.equal(schemaAfter, schemaBefore, "la tabla activities no cambia");

    const migratedApp = createApp({ db: migrated, demoUserId: "owner", corsOrigin: "http://localhost:5173" });
    await request(migratedApp).post("/api/activities").send({ ...valid, intensity: "moderate" });
    const res = await request(migratedApp).get("/api/activities");
    assert.deepEqual(
      res.body.map((a: { notes: string | null; intensity: string | null }) => [a.notes, a.intensity]),
      [[null, "moderate"], ["Registro de HU1", null]],
    );
    migrated.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
