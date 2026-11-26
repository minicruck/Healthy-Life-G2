// Pruebas de HU1 contra la API real con una base de datos SQLite en memoria.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";

let app: ReturnType<typeof createApp>;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({ db, demoUserId: "test-user", corsOrigin: "http://localhost:5173" });
});

afterEach(() => db.close());

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

test("HU7 edita y elimina solo el registro indicado; el progreso se recalcula", async () => {
  const goal = await request(app).get("/api/training-goal");
  const day = goal.body.weekStart;
  const first = await request(app).post("/api/activities").send({intensity:"moderate",activityType:"walking", activityDate:day, notes:"Original"});
  const second = await request(app).post("/api/activities").send({intensity:"moderate",activityType:"cycling", activityDate:day});
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal((await request(app).get("/api/training-goal")).body.completedDays, 1);
  const updated = await request(app).patch(`/api/activities/${first.body.id}`).send({activityType:"running", activityDate:"2020-01-01", notes:"  Corregida  ", userId:"otra"});
  assert.equal(updated.status, 200);
  assert.equal(updated.body.id, first.body.id);
  assert.equal(updated.body.createdAt, first.body.createdAt);
  assert.equal(updated.body.notes, "Corregida");
  assert.equal(updated.body.activityType, "running");
  assert.equal((await request(app).get("/api/training-goal")).body.completedDays, 1);
  assert.equal((await request(app).delete(`/api/activities/${second.body.id}`)).status, 204);
  assert.equal((await request(app).get("/api/training-goal")).body.completedDays, 0);
  assert.deepEqual((await request(app).get("/api/activities")).body, [updated.body]);
});

test("HU7 rechaza datos e identificadores inválidos y protege otros usuarios", async () => {
  const first = await request(app).post("/api/activities").send({intensity:"moderate",activityType:"walking", activityDate:"2026-10-09"});
  const otherApp = createApp({db, demoUserId:"other-user", corsOrigin:"http://localhost:5173"});
  const valid = {activityType:"running", activityDate:"2026-10-10", notes:null};
  for (const id of ["0", "-1", "1.5", "abc", "01"]) {
    assert.equal((await request(app).patch(`/api/activities/${id}`).send(valid)).status, 400);
    assert.equal((await request(app).delete(`/api/activities/${id}`)).status, 400);
  }
  for (const payload of [{...valid, activityDate:"2026-02-30"}, {...valid, activityType:"x"}, {...valid, notes:"a".repeat(501)}]) {
    assert.equal((await request(app).patch(`/api/activities/${first.body.id}`).send(payload)).status, 400);
  }
  assert.equal((await request(otherApp).patch(`/api/activities/${first.body.id}`).send(valid)).status, 404);
  assert.equal((await request(otherApp).delete(`/api/activities/${first.body.id}`)).status, 404);
  assert.equal((await request(app).delete("/api/activities/99999")).status, 404);
  assert.deepEqual((await request(app).get("/api/activities")).body, [first.body]);
});

test("HU7 conserva, modifica y elimina la intensidad de HU4", async () => {
  const first = await request(app).post("/api/activities").send({activityType:"walking", activityDate:"2026-10-09", intensity:"high"});
  assert.equal(first.status, 201);
  const url = `/api/activities/${first.body.id}`;
  const changes = {activityType:"running", activityDate:"2026-10-10"};
  const kept = await request(app).patch(url).send(changes);
  assert.equal(kept.status, 200);
  assert.equal(kept.body.intensity, "high");
  const edited = await request(app).patch(url).send({...changes, intensity:"low"});
  assert.equal(edited.status, 200);
  assert.equal(edited.body.intensity, "low");
  for (const intensity of [null, "", "invalid", 4]) {
    assert.equal((await request(app).patch(url).send({...changes, intensity})).status, 400);
  }
  assert.equal(db.prepare("SELECT intensity FROM activity_intensity WHERE activity_id = ?").get(first.body.id)?.intensity, "low");
  assert.equal((await request(app).delete(url)).status, 204);
  assert.equal(db.prepare("SELECT intensity FROM activity_intensity WHERE activity_id = ?").get(first.body.id), undefined);
});

test("HU7 edita registros anteriores a HU4 sin inventar intensidad y permite completarla", async () => {
  const result = db.prepare("INSERT INTO activities (user_id, activity_type, activity_date, notes, created_at) VALUES (?, ?, ?, ?, ?)").run("test-user", "walking", "2026-10-09", null, "2026-10-09T10:00:00.000Z");
  const url = `/api/activities/${result.lastInsertRowid}`;
  const changes = {activityType:"cycling", activityDate:"2026-10-10"};
  const kept = await request(app).patch(url).send(changes);
  assert.equal(kept.status, 200);
  assert.equal(kept.body.intensity, null);
  const edited = await request(app).patch(url).send({...changes, intensity:"moderate"});
  assert.equal(edited.status, 200);
  assert.equal(edited.body.intensity, "moderate");
});

test("HU7 conserva la edición y eliminación después de reabrir SQLite", async () => {
  const directory = mkdtempSync(join(tmpdir(), "healthy-life-hu7-"));
  const path = join(directory, "activities.sqlite");
  let stored = openDatabase(path);
  try {
    const localApp = createApp({db: stored, demoUserId:"test-user", corsOrigin:"http://localhost:5173"});
    const first = await request(localApp).post("/api/activities").send({intensity:"moderate",activityType:"walking", activityDate:"2026-10-09"});
    const second = await request(localApp).post("/api/activities").send({intensity:"moderate",activityType:"cycling", activityDate:"2026-10-08"});
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal((await request(localApp).patch(`/api/activities/${first.body.id}`).send({activityType:"running", activityDate:"2026-10-10"})).status, 200);
    assert.equal((await request(localApp).delete(`/api/activities/${second.body.id}`)).status, 204);
    stored.close();
    stored = openDatabase(path);
    const reopened = createApp({db: stored, demoUserId:"test-user", corsOrigin:"http://localhost:5173"});
    const res = await request(reopened).get("/api/activities");
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, first.body.id);
    assert.equal(res.body[0].activityType, "running");
    assert.equal(res.body[0].activityDate, "2026-10-10");
  } finally {
    stored.close();
    rmSync(directory, {recursive:true, force:true});
  }
});
