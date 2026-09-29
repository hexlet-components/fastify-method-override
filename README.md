# @hexlet/fastify-method-override

Форк [corsicanec82/fastify-method-override](https://github.com/corsicanec82/fastify-method-override),
который не обновлялся с 2023 года и не работает с Fastify 5: плагин объявлен как
`async (fastify, opts, next)` и при этом зовёт `next()`, а Fastify 5 такое
отвергает — «plugin being registered mixes async and callback styles».

Что изменено относительно апстрима:

- плагин объявлен только с `async`, без `next`;
- **зависимостей нет ни одной.** Апстрим тянул `lodash`, `http-errors`,
  `path-to-regexp` и `fastify-plugin`, все четыре пакета CJS. На ESM без сборки
  именованный импорт из такого пакета ломается в рантайме, поэтому каждый
  заменён обычным JS: матчер маршрута написан на `RegExp`, ошибка это `Error`
  с `statusCode`, а метку `skip-override` плагин ставит сам;
- пакет отдаётся как ESM без сборки, `babel` убран;
- тесты переведены с `jest` на `vitest`, линтер с `eslint` на `oxlint` и `oxfmt`;
- добавлен прогон чистой нодой (`__tests__/smoke.mjs`). Он нужен потому, что
  раннер трансформирует модули и прячет отказ CJS-импорта: пакет без сборки
  падал в приложении на `import { NotFound } from "http-errors"`, а тесты при
  этом были зелёные.

Поведение и публичный интерфейс не менялись: те же 45 тестов апстрима зелёные.

## Установка

Пакет в npm не публикуется, зависимость берётся прямо с GitHub:

```json
{
  "dependencies": {
    "@hexlet/fastify-method-override": "git+https://github.com/hexlet-components/fastify-method-override.git"
  }
}
```

Сборочного шага нет, поэтому такая установка работает без `prepare`: пакетный
менеджер тянет репозиторий и берёт `src/index.js` как есть. Конкретный коммит
фиксирует lock-файл потребителя.

[![github action status](https://github.com/hexlet-components/fastify-method-override/actions/workflows/nodeci.yml/badge.svg)](https://github.com/hexlet-components/fastify-method-override/actions)

Plugin for [Fastify](http://fastify.io/), which allows use HTTP verbs, such as DELETE, PATCH, HEAD, PUT, OPTIONS in case the client doesn't support them. Supports Fastify `5.x`.

## Install

```sh
pnpm add git+https://github.com/hexlet-components/fastify-method-override.git
```

## Usage

``` javascript
import fastify from 'fastify';
import fastifyMethodOverride from '@hexlet/fastify-method-override';

const app = fastify();

app.register(fastifyMethodOverride);
```

To override the HTTP method, use the HTML form with the hidden _method field and the value of the target method:

```html
<form method="POST" action="/url">
  <input type="hidden" name="_method" value="DELETE">
  <input type="submit" value="Submit">
</form>
```

### Note

If you use setNotFoundHandler, the plugin may not work correctly. In order to override the standard 404 error handler, you must use setErrorHandler.

If you are having trouble using the plugin, you can use the [`fastify-method-override-wrapper`](https://github.com/corsicanec82/fastify-method-override-wrapper) library.
