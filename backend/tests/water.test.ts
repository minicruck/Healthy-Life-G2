import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";

let app: ReturnType<typeof createApp>;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({
    db,
    demoUserId: "test-user",
    corsOrigin: "http://localhost:5173",
  });
});

test("returns a zero daily total when no water has been recorded", async () => {
  const response = await request(app).get("/api/water/today");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    date: response.body.date,
    totalMl: 0,
  });
  assert.match(response.body.date, /^\d{4}-\d{2}-\d{2}$/);
});

test("persists water entries and adds them to the daily total", async () => {
  const first = await request(app).post("/api/water").send({ amountMl: 250 });
  assert.equal(first.status, 201);
  assert.equal(first.body.amountMl, 250);
  assert.equal(first.body.dailyTotalMl, 250);
  assert.match(first.body.consumedDate, /^\d{4}-\d{2}-\d{2}$/);

  const second = await request(app).post("/api/water").send({ amountMl: 500 });
  assert.equal(second.status, 201);
  assert.equal(second.body.dailyTotalMl, 750);

  const summary = await request(app).get("/api/water/today");
  assert.equal(summary.body.totalMl, 750);
  const row = db
    .prepare("SELECT user_id, amount_ml FROM water_entries WHERE id = ?")
    .get(1) as Record<string, unknown>;
  assert.equal(row.user_id, "test-user");
  assert.equal(row.amount_ml, 250);
});

test("lists saved water entries newest first for the configured user", async () => {
  const first = await request(app).post("/api/water").send({ amountMl: 250 });
  const second = await request(app).post("/api/water").send({ amountMl: 500 });

  const history = await request(app).get("/api/water");

  assert.equal(history.status, 200);
  assert.deepEqual(
    history.body.map((entry: { id: number }) => entry.id),
    [second.body.id, first.body.id],
  );
  assert.deepEqual(
    history.body.map((entry: { amountMl: number }) => entry.amountMl),
    [500, 250],
  );
});

test("rejects empty, zero, negative and non-numeric amounts without saving", async () => {
  for (const amountMl of [
    undefined,
    0,
    -250,
    "250",
    null,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    const response = await request(app).post("/api/water").send({ amountMl });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  }
  assert.equal((await request(app).get("/api/water/today")).body.totalMl, 0);
});
