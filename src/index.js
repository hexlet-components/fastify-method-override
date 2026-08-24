// Плагин без зависимостей. Апстрим тянул lodash, http-errors и path-to-regexp,
// все три пакета CJS, и на ESM без сборки именованный импорт из них ломался в
// рантайме. Каждый из трёх заменён обычным JS.

const SKIP_OVERRIDE = Symbol.for("skip-override");

const overridableMethods = new Set(["HEAD", "PUT", "DELETE", "OPTIONS", "PATCH"]);

const notFound = (message) => Object.assign(new Error(message), { statusCode: 404 });

const toArray = (value) => {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const escapeSegment = (segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Матчер по шаблону маршрута fastify: `:name` это один сегмент пути, `*` это
// весь остаток. Совпавшие значения отдаются в том же виде, в каком их отдал бы
// сам fastify, потому что обработчик читает их из `request.params`.
const buildMatcher = (url) => {
  const names = [];
  let hasWildcard = false;

  const source = url
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        names.push(segment.slice(1));
        return "([^/]+)";
      }
      if (segment === "*") {
        hasWildcard = true;
        return "(.*)";
      }
      return escapeSegment(segment);
    })
    .join("/");

  const pattern = new RegExp(`^${source}/?$`);

  return (pathname) => {
    const found = pattern.exec(pathname);
    if (found === null) {
      return null;
    }

    const params = Object.fromEntries(
      names.map((name, index) => [name, decodeURIComponent(found[index + 1])]),
    );

    if (hasWildcard) {
      params["*"] = decodeURIComponent(found[names.length + 1]);
    }

    return params;
  };
};

// Хук маршрута бывает и async, и колбэчным, поэтому поддерживаются оба вида:
// колбэк получает `done`, а промис дожидается сам.
const runHook = (hook, request, reply) =>
  new Promise((resolve, reject) => {
    const result = hook(request, reply, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    if (typeof result?.then === "function") {
      result.then(() => resolve(), reject);
    }
  });

const fastifyMethodOverride = async (fastify) => {
  const routesByMethod = new Map();

  const override = async (request, reply) => {
    if (request.raw.method.toUpperCase() !== "POST") {
      return;
    }

    const method = String(request.body?._method ?? "").toUpperCase();
    if (!overridableMethods.has(method)) {
      return;
    }

    const url = request.raw.url;
    const routes = routesByMethod.get(method) ?? [];
    const found = routes
      .map((route) => ({ route, params: route.match(url) }))
      .find(({ params }) => params !== null);

    // Конфиг маршрута апстрим кладёт в `reply.context.config`, и обработчики
    // читают его оттуда. В fastify 5 такого свойства нет вовсе, то есть объект
    // создаёт сам плагин. Поведение сохранено: на нём держатся потребители.
    reply.context = {
      ...reply.context,
      config: { ...found?.route.config, ...reply.context?.config, method },
    };

    if (found === undefined) {
      throw notFound(`Route ${method}:${url} not found`);
    }

    request.params = found.params;
    request.raw.method = method;

    // Хуки подменённого маршрута зовутся руками: fastify отработал хуки
    // POST-маршрута, а у подменённого свои. Без них правка и удаление прошли бы
    // мимо авторизации, объявленной у PATCH и DELETE.
    for (const hook of found.route.hooks) {
      await runHook(hook, request, reply);
      if (reply.sent) {
        return;
      }
    }

    await found.route.handler(request, reply);
  };

  fastify.addHook("onRoute", (routeOptions) => {
    const methods = toArray(routeOptions.method).map((method) => method.toUpperCase());

    const overridable = methods.find((method) => overridableMethods.has(method));
    if (overridable !== undefined) {
      const routes = routesByMethod.get(overridable) ?? [];
      routes.push({
        match: buildMatcher(routeOptions.url),
        handler: routeOptions.handler,
        config: routeOptions.config,
        hooks: [...toArray(routeOptions.preValidation), ...toArray(routeOptions.preHandler)],
      });
      routesByMethod.set(overridable, routes);
    }

    if (methods.includes("POST")) {
      routeOptions.preHandler = [override, ...toArray(routeOptions.preHandler)];
    }
  });

  // Формы отправляют POST на адреса вида `/users/:id`, где POST-маршрута нет
  // вовсе, поэтому одного `preHandler` мало: до него дело не доходит, запрос
  // уходит в «не найдено».
  fastify.setNotFoundHandler({ preHandler: override }, (request, reply) => {
    reply.code(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.raw.method}:${request.raw.url} not found`,
    });
  });
};

// Метка `skip-override` говорит fastify не создавать для плагина отдельный
// контекст: `addHook('onRoute')` и `setNotFoundHandler` должны действовать на
// то приложение, куда плагин зарегистрирован. Раньше её ставил fastify-plugin,
// но это тоже CJS-пакет, а метка ставится одной строкой.
fastifyMethodOverride[SKIP_OVERRIDE] = true;

export default fastifyMethodOverride;
