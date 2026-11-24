// Pruebas de HU1 contra la API real con una base de datos SQLite en memoria.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";

let app: ReturnType<typeof createApp>;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({ db, demoUserId: "test-user", corsOrigin: "http://localhost:5173" });
});

test("registra una actividad válida, devuelve 201 y queda guardada", async () => {
  const res = await request(app)
    .post("/api/activities")
    .send({ activityType: "walking", activityDate: "2026-10-09", notes: "Caminata por el parque", intensity: "moderate" });

  assert.equal(res.status, 201);
  assert.equal(res.body.id, 1);
  assert.equal(res.body.activityType, "walking");
  assert.equal(res.body.activityDate, "2026-10-09");
  assert.equal(res.body.notes, "Caminata por el parque");
  assert.ok(!Number.isNaN(Date.parse(res.body.createdAt)));

  // Comprobación directa en la base de datos: está guardada de verdad.
  const row = db.prepare("SELECT * FROM activities WHERE id = ?").get(1) as Record<string, unknown>;
  assert.equal(row.activity_type, "walking");
  assert.equal(row.user_id, "test-user");
});

test("las notas son opcionales y se devuelven como null", async () => {
  const res = await request(app)
    .post("/api/activities")
    .send({ activityType: "gym", activityDate: "2026-10-08", intensity: "high" });
  assert.equal(res.status, 201);
  assert.equal(res.body.notes, null);
});

test("rechaza un tipo de actividad no permitido", async () => {
  const res = await request(app)
    .post("/api/activities")
    .send({ activityType: "swimming", activityDate: "2026-10-09" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("rechaza fechas con formato incorrecto o inexistentes", async () => {
  for (const activityDate of ["09/10/2026", "2026-02-30", "2026-13-01", "", undefined]) {
    const res = await request(app)
      .post("/api/activities")
      .send({ activityType: "running", activityDate });
    assert.equal(res.status, 400, `debería rechazar ${activityDate}`);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
});

test("rechaza un JSON mal formado sin exponer detalles internos", async () => {
  const res = await request(app)
    .post("/api/activities")
    .set("Content-Type", "application/json")
    .send("{ esto no es json");
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("no guarda nada cuando los datos son inválidos", async () => {
  await request(app).post("/api/activities").send({ activityType: "x", activityDate: "mal" });
  const res = await request(app).get("/api/activities");
  assert.deepEqual(res.body, []);
});

test("permite el origen del frontend por CORS", async () => {
  const res = await request(app)
    .options("/api/activities")
    .set("Origin", "http://localhost:5173")
    .set("Access-Control-Request-Method", "POST");
  assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
});
