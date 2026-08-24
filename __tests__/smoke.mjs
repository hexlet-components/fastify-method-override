// Прогон чистой нодой, без трансформа тестового раннера.
//
// Пакет отдаётся как ESM, а зависимости `http-errors` и `path-to-regexp` это
// CJS. Именованный импорт из такого пакета нода разбирает только когда экспорты
// видны статически, и у этих двух они собираются в рантайме. Под vitest такой
// импорт работает, потому что раннер модули трансформирует, поэтому отказ
// вылезал не в тестах, а в приложении: «does not provide an export named
// NotFound». Этот файл запускается нодой напрямую и такой отказ ловит.

import assert from "node:assert/strict";

import formbody from "@fastify/formbody";
import fastify from "fastify";

import methodOverride from "../src/index.js";

const app = fastify();
await app.register(formbody);
await app.register(methodOverride);

app.delete("/items/:id", async (req, reply) => reply.send({ method: "DELETE", id: req.params.id }));
app.patch(
  "/items/:id",
  {
    preValidation: async (req, reply) => {
      if (req.body?.deny) {
        return reply.code(401).send({ denied: true });
      }
      return undefined;
    },
  },
  async (req, reply) => reply.send({ method: "PATCH", id: req.params.id }),
);

await app.ready();

const post = (payload) =>
  app.inject({
    method: "POST",
    url: "/items/7",
    payload,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });

const deleted = await post("_method=delete");
assert.equal(deleted.statusCode, 200);
assert.deepEqual(deleted.json(), { method: "DELETE", id: "7" });

const patched = await post("_method=patch");
assert.equal(patched.statusCode, 200);
assert.deepEqual(patched.json(), { method: "PATCH", id: "7" });

// Хуки подменённого маршрута обязаны отработать: без них правка и удаление
// стали бы доступны в обход preValidation.
const denied = await post("_method=patch&deny=1");
assert.equal(denied.statusCode, 401);

await app.close();

console.log("smoke: 3 проверки пройдены");
