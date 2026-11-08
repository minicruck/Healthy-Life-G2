// Pruebas de Calidad del sueño (CA1 - CA5).
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db.ts";
import { getMadridToday } from "../src/sleepCalendar.ts";

let db: ReturnType<typeof openDatabase>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({ db, demoUserId: "test-user", corsOrigin: "http://localhost:5173" });
});
afterEach(() => db.close());

const today = () => getMadridToday();

test("CA1: registra fecha y valoración de 1 a 5 y queda guardada y confirmada", async () => {
  const response = await request(app)
    .post("/api/sleep-quality")
    .send({
      sleepDate: today(),
      rating: 4,
      notes: "Noche tranquila y reparadora",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.sleepDate, today());
  assert.equal(response.body.rating, 4);
  assert.equal(response.body.notes, "Noche tranquila y reparadora");
  assert.equal(response.body.replaced, false);
  assert.ok(response.body.id > 0);

  // Comprobar que se puede consultar en la lista
  const list = await request(app).get("/api/sleep-quality");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].rating, 4);
  assert.equal(list.body[0].sleepDate, today());
});

test("CA2: la valoración es obligatoria (1 a 5); si falta o es inválida no se guarda y devuelve 400", async () => {
  const invalidRatings = [undefined, null, 0, 6, -1, 3.5, "4", "", {}, []];

  for (const rating of invalidRatings) {
    const res = await request(app)
      .post("/api/sleep-quality")
      .send({
        sleepDate: today(),
        rating,
        notes: "Test",
      });

    assert.equal(res.status, 400, `Falló para rating: ${rating}`);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }

  // Verificar que la base de datos sigue vacía
  const list = await request(app).get("/api/sleep-quality");
  assert.equal(list.body.length, 0);
});

test("CA3: no se permiten fechas futuras ni fechas inválidas; se informa del error", async () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000 * 2)
    .toISOString()
    .slice(0, 10);

  const resFuture = await request(app)
    .post("/api/sleep-quality")
    .send({
      sleepDate: future,
      rating: 5,
    });

  assert.equal(resFuture.status, 400);
  assert.equal(resFuture.body.error.code, "VALIDATION_ERROR");
  assert.ok(resFuture.body.error.message.includes("futura"));

  const resInvalid = await request(app)
    .post("/api/sleep-quality")
    .send({
      sleepDate: "fecha-no-valida",
      rating: 5,
    });
  assert.equal(resInvalid.status, 400);
  assert.equal(resInvalid.body.error.code, "VALIDATION_ERROR");
});

test("CA4: una valoración por noche: si ya existe, se rechaza con 409 o se sustituye con overwrite sin duplicar", async () => {
  // Primer registro
  const res1 = await request(app)
    .post("/api/sleep-quality")
    .send({
      sleepDate: today(),
      rating: 3,
      notes: "Regular",
    });
  assert.equal(res1.status, 201);

  // Segundo registro para la misma fecha sin overwrite: rechaza con 409
  const resDuplicate = await request(app)
    .post("/api/sleep-quality")
    .send({
      sleepDate: today(),
      rating: 5,
      notes: "Cambio de opinión",
      overwrite: false,
    });
  assert.equal(resDuplicate.status, 409);
  assert.equal(resDuplicate.body.error.code, "ALREADY_EXISTS");
  assert.equal(resDuplicate.body.existing.rating, 3);

  // Registro con overwrite: true sustituye sin duplicar
  const resOverwrite = await request(app)
    .post("/api/sleep-quality")
    .send({
      sleepDate: today(),
      rating: 5,
      notes: "Sustituido: excelente",
      overwrite: true,
    });
  assert.equal(resOverwrite.status, 200);
  assert.equal(resOverwrite.body.rating, 5);
  assert.equal(resOverwrite.body.notes, "Sustituido: excelente");
  assert.equal(resOverwrite.body.replaced, true);

  // Comprobar que en la base de datos solo hay 1 fila
  const list = await request(app).get("/api/sleep-quality");
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].rating, 5);
  assert.equal(list.body[0].notes, "Sustituido: excelente");
});

test("CA5: comentario opcional de hasta 200 caracteres se guarda; mayor a 200 se rechaza", async () => {
  // Sin comentario: se guarda con notes = null
  const resNoNotes = await request(app)
    .post("/api/sleep-quality")
    .send({
      sleepDate: today(),
      rating: 4,
    });
  assert.equal(resNoNotes.status, 201);
  assert.equal(resNoNotes.body.notes, null);

  // Comentario de exactamente 200 caracteres
  const text200 = "a".repeat(200);
  const res200 = await request(app)
    .post("/api/sleep-quality")
    .send({
      sleepDate: today(),
      rating: 4,
      notes: text200,
      overwrite: true,
    });
  assert.equal(res200.status, 200);
  assert.equal(res200.body.notes, text200);

  // Comentario de 201 caracteres: se rechaza con 400
  const text201 = "a".repeat(201);
  const res201 = await request(app)
    .post("/api/sleep-quality")
    .send({
      sleepDate: today(),
      rating: 4,
      notes: text201,
      overwrite: true,
    });
  assert.equal(res201.status, 400);
  assert.equal(res201.body.error.code, "VALIDATION_ERROR");
  assert.ok(res201.body.error.message.includes("200"));
});
