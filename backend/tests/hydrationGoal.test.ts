import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const db = openDatabase(":memory:");
  app = createApp({ db, demoUserId: "test-user", corsOrigin: "http://localhost:5173" });
});

test("devuelve que no hay meta configurada", async () => {
  const res = await request(app).get("/api/hydration-goal");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { litersPerDay: null, updatedAt: null });
});

test("guarda una meta válida y la devuelve", async () => {
  const save = await request(app)
    .put("/api/hydration-goal")
    .send({ litersPerDay: 2 });
  assert.equal(save.status, 200);
  assert.equal(save.body.litersPerDay, 2);
  assert.ok(!Number.isNaN(Date.parse(save.body.updatedAt)));

  const read = await request(app).get("/api/hydration-goal");
  assert.equal(read.body.litersPerDay, 2);
});

test("actualiza la meta sin crear registros de consumo", async () => {
  await request(app).put("/api/hydration-goal").send({ litersPerDay: 2 });
  const res = await request(app).put("/api/hydration-goal").send({ litersPerDay: 2.5 });
  assert.equal(res.status, 200);
  assert.equal(res.body.litersPerDay, 2.5);
});

test("rechaza metas vacías, cero, negativas y no numéricas", async () => {
  for (const litersPerDay of [undefined, 0, -1, "2", NaN]) {
    const res = await request(app).put("/api/hydration-goal").send({ litersPerDay });
    assert.equal(res.status, 400, `debería rechazar ${litersPerDay}`);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  const read = await request(app).get("/api/hydration-goal");
  assert.equal(read.body.litersPerDay, null);
});
