# Red social de recetas — Diseño técnico

> Documento de arquitectura, listo para implementación. Refleja el alcance aprobado en `docs/functional-design/2026-08-13-red-social-de-recetas-diseno-funcional.md`.

## Tabla de contenidos

1. Contexto y alcance aprobado
2. Objetivos arquitectónicos y no-objetivos
3. Elección de arquitectura y justificación
4. Mapa de módulos y bounded contexts
5. Modelo de datos y propiedad de cada agregado
6. Contratos: API REST, eventos internos, integraciones externas
7. Modelo de seguridad y permisos
8. Comportamiento de error, carga, vacío y recuperación
9. Estrategia de despliegue y migraciones
10. Secuencia de implementación por tajadas verificables
11. Riesgos, suposiciones y preguntas abiertas
12. Estrategia de verificación

---

## 1. Contexto y alcance aprobado

Producto web responsive tipo red social centrado en recetas, con descubrimiento social (feed, búsqueda, filtros por alérgenos y dietas), publicación de recetas, social (seguir, guardar en colecciones, comentar, valorar), organización (plan semanal y lista de compra) y moderación manual.

Idioma: español. Mercado objetivo: hispanohablante. Sin app móvil, sin monetización, sin SSO social, sin recomendaciones por ML en MVP. Catálogo inicial: ≥ 30 recetas seed.

Hay una puerta pendiente entre el funcional (aprobado) y la implementación: este documento debe aprobarse antes de empezar a escribir código.

## 2. Objetivos arquitectónicos y no-objetivos

### Objetivos

- **OA-1 Seguridad de datos sensibles de salud.** Alérgenos y restricciones alimentarias se modelan como dato auditable con vocabulario cerrado. El sistema nunca debe devolver falsos negativos: si un alérgeno figura declarado en una receta, jamás debe aparecer en un resultado donde la persona lo ha excluido.
- **OA-2 Latencia aceptable en feeds.** Primera vista bajo 2,5 s en 3G estable (RF-62). Feed cronológico y «seguidos» con scroll infinito de 20 elementos por lote.
- **OA-3 Aislamiento entre contextos.** Cambios en moderación, planificación semanal o almacenamiento de imágenes no deben propagarse al modelo de Receta. Cada bounded context expone y consume solo lo que necesita.
- **OA-4 Portabilidad de dominio.** Reglas de negocio (p. ej. consolidación de ingredientes en lista de compra) viven en capa de dominio, no acopladas a Express ni a Mongo.
- **OA-5 Operación simple.** Despliegue con un único proceso de API y una única base de datos. Sin Kubernetes, sin colas externas en MVP; trabajos asíncronos en proceso cuando aplique.
- **OA-6 Trazabilidad de moderación.** Toda acción de moderación queda registrada con actor, elemento afectado, motivo y fecha.

### No-objetivos

- Aplicación móvil nativa y notificaciones push.
- Mensajería privada entre personas usuarias.
- Recomendaciones por machine learning.
- Pagos, suscripciones o modelado de ingresos.
- Internacionalización completa; en MVP solo `es-ES`.

## 3. Elección de arquitectura y justificación

### Stack

- **Backend:** Node.js (LTS 20.x) con TypeScript estricto + Express 5 + Mongoose para MongoDB.
- **Frontend:** Angular 18 con standalone components, señales para estado local, lazy routes por defecto, SSR desactivado en MVP (la UI no se posiciona en buscadores críticos y `preview` interno es HTML+JS).
- **Persistencia:** MongoDB 7.x en una sola instancia lógica (replica set de 3 nodos en producción).
- **Almacenamiento de imágenes:** filesystem local detrás de una interfaz `ImageStore`, con un adaptador S3 preparado (sin activar la integración externa en MVP) para no reescribir cuando se escale.
- **Correo transaccional:** interfaz `Mailer` con adaptador SMTP (`nodemailer`) en dev y SendGrid como adaptador futuro, detrás de la misma interfaz.
- **Búsqueda:** índices de texto de MongoDB en MVP; se documenta punto de corte para introducir OpenSearch si el tamaño lo exige.

### Justificación

- El dominio es rico (recetas con vocabularios cerrados, agregación de ingredientes, reglas de filtrado por alérgenos, planificación semanal). TypeScript estricto + capas claras protegen la invariante de alérgenos.
- MongoDB encaja bien con documentos `Receta` casi siempre leídos completos (imagen, ingredientes, pasos). El agregado es natural y cabe en un documento.
- Angular con standalone + señales reduce boilerplate y mejora tiempo de arranque. La carga de receta individual es pantalla caliente: SSR no aporta lo suficiente como para justificar la complejidad en MVP.
- La elección de filesystem para imágenes en MVP evita dependencias externas y降低成本 de puesta en marcha; la abstracción `ImageStore` mantiene la puerta abierta a S3.

### Alternativas consideradas

| Decisión | Alternativa | Motivo del rechazo |
|---|---|---|
| Stack MEAN full | Next.js + Postgres | El modelo de Receta se siente más natural embebido en MongoDB; menos fricción para filtros por etiquetas y arrays. |
| SSR Angular | Angular con SSR | SEO de recetas es secundario en MVP; las rutas privadas (perfil, plan) no se indexan; coste operativo no compensa. |
| Servicio externo de correo directo | SMTP puro en MVP | La interfaz `Mailer` ya desacopla; SMTP local en dev (MailHog/Mailpit) sin coste. |
| Búsqueda con ElasticSearch | Mongo `$text` | Tamaños de catálogo MVP (< 100k recetas) no justifican el coste operativo; documentado punto de salida a OpenSearch. |

## 4. Mapa de módulos y bounded contexts

```
apps/api/src/modules/
├── identity/        # Auth, registro, verificación, recuperación
├── catalog/         # Recetas, ingredientes, pasos, etiquetas, alérgenos
├── discovery/       # Feeds, búsqueda, filtros, relacionadas, OG
├── social/          # Seguir, guardar en colecciones, comentarios, valoraciones, compartir
├── planning/        # Plan semanal, lista de compra, exportaciones
├── moderation/      # Reportes, cola, acciones, auditoría
└── media/           # Subida y entrega de imágenes (avatar y recetas)

shared/              # cross-cutting: AppError, requestId, auth middleware, permisos
contracts/           # DTOs y tipos compartidos con frontend
infrastructure/      # adaptadores: Mongo, ImageStore, Mailer, Clock
```

Cada contexto expone:

- **router** → mapea HTTP a casos de uso.
- **controller** → valida input, delega, mapea errores de dominio a HTTP.
- **service** → orquesta reglas de negocio y transacciones.
- **repository** → única vía de acceso a Mongo.
- **schema** (Mongoose) → restricciones técnicas; las reglas de negocio viven en el service.

Las dependencias entre contextos van solo a través de identificadores y contratos publicados:

- `catalog` es núcleo. `discovery` lo lee por proyección (summary), nunca modifica.
- `social` referencia Recetas y Usuarios por id; no accede al documento de Receta.
- `planning` lee Recetas vía `catalog` para proyectar ingredientes sin acoplarse al documento completo.
- `moderation` consume referencias tanto de `catalog` como de `social` mediante sus APIs públicas.

Anti-Corruption Layer: el campo `alérgenos` que sale de la base se normaliza contra el vocabulario canónico (ver §5.2) en la frontera del servicio `catalog`; nada en otra capa asume el shape crudo de Mongo.

## 5. Modelo de datos y propiedad de cada agregado

### 5.1 Vocabularios cerrados como dato

Se almacenan en colecciones independientes `allergens` y `diets`, sembradas en arranque. Ningún servicio acepta ids o nombres fuera de catálogo: cualquier valor entrante se valida contra la colección correspondiente y, si no existe, se rechaza con `422 UnknownAllergen` / `422 UnknownDiet`.

### 5.2 Vocabulario canónico de alérgenos (UE 1169/2011)

`gluten`, `crustaceos`, `huevos`, `pescado`, `cacahuetes`, `soja`, `leche`, `frutos_cascara`, `apio`, `mostaza`, `sesamo`, `sulfitos`, `moluscos`, `altramuces` (14 ítems).

### 5.3 Unidades de ingredientes

Unidades admitidas: `g`, `kg`, `ml`, `l`, `ud`, `cdita`, `cdta`, `taza`, `pizca`, `diente`, `rebanada`.

Conversión a base SI:

| Unidad destino | Base | Factor (origen → base) |
|---|---|---|
| g | g | `kg*1000`, resto = 1 |
| ml | ml | `l*1000`, resto = 1 |
| ud | ud | resto = 1 |

Las unidades `pizca`, `diente`, `taza`, `cdita`, `cdta`, `rebanada` **no** se normalizan: el servicio de lista de compra las agrupa por texto con la cantidad sumada como número, sin tocar unidades. Esta regla se formaliza para cumplir CA-04 sin generar falsos cálculos.

### 5.4 Aggregates y colecciones

#### Aggregate raíz `Receta`

| Campo | Tipo | Restricción |
|---|---|---|
| `_id` | ObjectId | generado |
| `autorId` | ref Usuario | obligatorio |
| `titulo` | string | 5–80 |
| `descripcion` | string | ≤ 500 |
| `imagenPrincipalId` | ObjectId imagen | obligatorio al publicar |
| `categoria` | enum | una de las del catálogo |
| `tiempoPrepMin` | int ≥ 0 | minutos |
| `tiempoCoccionMin` | int ≥ 0 | minutos |
| `raciones` | int 1–20 | obligatorio |
| `dificultad` | enum `Fácil\|Media\|Difícil` | obligatorio |
| `dietas` | string[] | ids canónicos |
| `alergenos` | string[] | ids canónicos |
| `ingredientes` | array | min 1: `{nombre, cantidad, unidad}` |
| `pasos` | array | min 1: `{orden, texto}` (≤ 300) |
| `publicadaEn` | Date | nulo en borrador |
| `estado` | enum `borrador\|publicada\|oculta` | invariante dominio |
| `createdAt`, `updatedAt` | Date |  |

**Invariantes dentro del agregado**:

- Si `estado == 'publicada'` entonces todos los campos obligatorios están presentes y `imagenPrincipalId` resuelto.
- `alergenos` ⊆ vocabulario canónico.
- `dietas` ⊆ vocabulario canónico.
- `categoría` y `dificultad` ∈ enums cerrados.

Solo el service de `catalog` modifica `Receta`. Borrado es soft (`oculta`). El campo `estado` se cambia mediante métodos explícitos: `publicar()`, `ocultar(motivo)`, `republicar()`.

#### Aggregate raíz `Usuario` (en `identity`)

`email`, `hashContrasena`, `nombrePublico`, `avatarImagenId`, `bio`, `pais?`, `rol` (`user|moderator|admin`), `verificadoEn`, `createdAt`. Borrado: `estadoCuenta = 'eliminada'`, email bloqueado, autor de recetas/comentarios reasignado a `Cuenta eliminada`.

#### `Valoracion`

Documento independiente con índice único `(usuarioId, recetaId)`. Media se calcula en cache de lectura (campo `receta.mediaValoraciones`, `receta.numValoraciones`) que se actualiza en transacción tras cada `upsert/delete`.

#### `Comentario`

Documento embebido por niveles: un comentario raíz `{ recetaId, autorId, texto, fecha, oculto }` y, como subdocumento limitado a un nivel, `respuestas: [{ autorId, texto, fecha, oculto }]`. Índices: `recetaId + fecha desc` para listado y `comentarioPadreId` para moderación.

#### `Guardado`

`(usuarioId, recetaId, coleccionId, fecha)`. Índice único `(usuarioId, recetaId, coleccionId)` evita doble guardado.

#### `Coleccion`

`{ usuarioId, nombre, creadaEn }`. La etiqueta «Favoritas» se crea automáticamente en registro y no se puede borrar.

#### `Seguimiento`

`(seguidorId, seguidoId, desde)` con índice único `(seguidorId, seguidoId)`.

#### `PlanSemanal`

Documento `{ usuarioId, lunes, entradas: [...] }`. Una entrada: `{ dia (lun..dom), tipo (desayuno|comida|cena|snack), recetaId, racionesAjustadas }`. Índice único `(usuarioId, lunes, dia, tipo)` impide colisiones.

#### `ListaCompra`

No se persiste: se calcula en lectura al pulsar «Generar lista de compra» y se entrega como documento inmutable al cliente, que gestiona el estado de comprado/no comprado en `localStorage`. Confirmación pendiente de negocio: si el usuario quiere sincronizar lista entre dispositivos, se introduce `ShoppingList { usuarioId, semanaId, items: [{producto, cantidad, unidad, comprado}]}` en una iteración posterior.

#### `Reporte`

`{ tipo: 'receta'|'comentario', objetivoId, motivo, reportadoPorId, estado: 'pendiente|'resuelto', acciones: [...] }` con auditoría inmutable.

### 5.5 Índices Mongo (resumen)

- `recetas`: `{ estado: 1, publicadaEn: -1 }` (feeds), `{ autorId: 1, publicadaEn: -1 }` (perfil), `{ titulo: 'text', descripcion: 'text', 'ingredientes.nombre': 'text' }` (búsqueda), `{ alergenos: 1 }` (filtro principal).
- `comentarios`: `{ recetaId: 1, fecha: -1 }`.
- `valoraciones`: único `{ usuarioId: 1, recetaId: 1 }`; secundario `{ recetaId: 1 }`.
- `guardados`: único `{ usuarioId: 1, recetaId: 1, coleccionId: 1 }`; secundario `{ usuarioId: 1, coleccionId: 1 }`.
- `seguimientos`: único `{ seguidorId: 1, seguidoId: 1 }`; secundario `{ seguidoId: 1 }` para contar seguidores.
- `plansemanales`: único `{ usuarioId: 1, lunes: 1, 'entradas.dia': 1, 'entradas.tipo': 1 }` parcial.
- `reportes`: `{ estado: 1, fecha: -1 }`.

Índices se crean al arranque con `ensureIndexes()` y se documentan en `apps/api/db/indexes.md`.

## 6. Contratos: API REST, eventos internos, integraciones externas

### 6.1 Convenciones HTTP

- Versión: prefijo `/v1`.
- Errores: `{ code, message, details?, traceId }`.
- Validación 400 (shape) vs 422 (semántica). Errores de dominio personalizados: `AppError extends Error { code, status, details? }`.
- `Idempotency-Key` obligatorio en `POST /v1/recipes` y `POST /v1/comments`. Cacheado 24h.
- Paginación: `?cursor=...&limit=20`. Cursor opaco (`base64({publicadaEn, _id})`).

### 6.2 Endpoints principales

#### Identidad

- `POST /v1/auth/register` → 201 con `user` + tokens.
- `POST /v1/auth/login` → 200 tokens.
- `POST /v1/auth/refresh` → 200 tokens.
- `POST /v1/auth/logout` → 204 invalida refresh.
- `POST /v1/auth/verify-email` → 200.
- `POST /v1/auth/forgot-password` y `POST /v1/auth/reset-password` → 204.
- `GET /v1/me`, `PATCH /v1/me`, `DELETE /v1/me` → cuenta propia.

#### Catálogo

- `POST /v1/recipes` (multipart con `imagen`) → 201.
- `GET /v1/recipes/:id` → 200 con Receta completa.
- `PATCH /v1/recipes/:id` (autor o moderador) → 200.
- `DELETE /v1/recipes/:id` (soft) → 204.
- `POST /v1/recipes/:id/publish` (si era borrador) → 200.

#### Descubrimiento

- `GET /v1/feed?scope=cronologico|seguidos` (20 por lote).
- `GET /v1/search?q=&alergenos=&dietas=&tiempoMax=&dificultad=&categoria=&sort=recientes|top|masGuardadas` → 200.
- `GET /v1/recipes/:id/related` → 200.
- `GET /v1/recipes/:id/og` → sirve HTML/og sin auth.

#### Social

- `POST /v1/users/:id/follow` y `DELETE /v1/users/:id/follow`.
- `GET /v1/users/:id` y `GET /v1/users/:id/recipes`.
- `GET /v1/me/collections`, `POST /v1/me/collections`, `PATCH /v1/me/collections/:id`, `DELETE /v1/me/collections/:id`.
- `POST /v1/recipes/:id/save` (body: `coleccionId`).
- `DELETE /v1/recipes/:id/save` y `GET /v1/me/saved`.
- `POST /v1/recipes/:id/rating` (body: `{estrellas}`) idempotente por usuario.
- `POST /v1/recipes/:id/comments` (anidado a un nivel).
- `DELETE /v1/comments/:id` (autor o moderador).

#### Planificación

- `GET /v1/me/week?lunes=YYYY-MM-DD` → plan de esa semana (crea si no existe).
- `POST /v1/me/week/entries` body `{lunes, dia, tipo, recetaId, racionesAjustadas}`.
- `PATCH /v1/me/week/entries/:id`, `DELETE /v1/me/week/entries/:id`.
- `POST /v1/me/shopping-list` body `{lunes}` → 200 con lista calculada.

#### Moderación (rol `moderator`)

- `GET /v1/moderation/reports?estado=pendiente`.
- `POST /v1/moderation/reports/:id/decision` body `{accion: 'ocultar'|'eliminar'|'rechazar', motivo}`.

#### Media

- `POST /v1/media` (multipart) → devuelve `imagenId` + URL.
- `GET /v1/media/:id` → entrega binaria con `Cache-Control: public, max-age=31536000, immutable`.

### 6.3 Eventos de dominio internos

Producidos por `catalog`, `social`, `planning`. Consumidos por `social` (feeds), `moderation` (autoocultar si > N reportes), `discovery` (cache de contadores). Se implementan con `EventEmitter` de Node y adaptador hacia Redis Pub/Sub futuro.

| Evento | Productor | Payload | Consumidores principales |
|---|---|---|---|
| `RecetaPublicada` | `catalog` | `{recetaId, autorId, publicadaEn}` | `discovery` (índice, contador de autor) |
| `RecetaOculta` | `catalog`/`moderation` | `{recetaId, motivo, autorId}` | `discovery` (purga cache) |
| `ComentarioPublicado` | `social` | `{recetaId, comentarioId, autorId}` | `moderation` (umbral) |
| `ReporteCreado` | `moderation` | `{tipo, objetivoId, reportadoPorId}` | `moderation` (cola) |
| `UsuarioEliminado` | `identity` | `{usuarioId, emailHash}` | `catalog`, `social`, `planning` (anonimización) |

### 6.4 Integraciones externas

- **SMTP** vía `Mailer` interface. Adaptador dev: `nodemailer` con MailHog/Mailpit. Adaptador prod futuro: SendGrid o AWS SES.
- **Almacenamiento de imágenes** vía `ImageStore`. Adaptador dev: filesystem local en `storage/media`. Adaptador prod: S3 (firmas pre-firmadas).
- **Open Graph**: servidor propio genera HTML y metadatos por receta (no depende de servicios externos en MVP).

## 7. Modelo de seguridad y permisos

- **Autenticación.** Access token JWT con `sub`, `rol`, `verificadoEn`, `exp=15min`, `aud=recipes-api`. Refresh token opaco persistido, rotación en cada uso, revocable, expira a 30 días. Hash con Argon2id (memCost 64 MB, timeCost 3, parallelism 1).
- **Autorización.** Middleware `requireAuth` y `requireRole('moderator')` por ruta. Todas las rutas que modifican recursos verifican propiedad: si el `autorId` o `usuarioId` del recurso no coincide con el `sub` del token, 403.
- **Validación de entrada.** Zod para todos los cuerpos y `query`. Se rechazan campos extra (`strict`). Límites: `titulo ≤ 80`, `descripcion ≤ 500`, `textoPaso ≤ 300`, `comentario ≤ 500`, `cantidad > 0`, `raciones 1–20`.
- **Datos sensibles.** Email y hash de contraseña nunca salen del backend. Los logs no imprimen token, email, ni contraseñas. Redacción explícita en logger.
- **Alérgenos.** Validación cruzada: el filtro «alérgenos a evitar» se aplica con `db.recipes.find({ alergenos: { $nin: ['gluten', ...] }, estado: 'publicada' })`. Cobertura probada con `CA-03` sobre set de 20 recetas sembradas que cubran combinaciones.
- **CORS** restrictivo para orígenes conocidos. **Helmet** + **rate limiting** por IP y por usuario (`express-rate-limit`, Redis cuando se escale). **CSP** estricta, `frame-ancestors 'none'`.
- **Subida de imágenes.** Límite 5 MB. Validación magic bytes (no solo MIME). Reescalado a 1600 px max, almacenado en WebP + fallback JPEG. URL firmadas o control de cache.
- **OWASP.** Coberturas explícitas en `apps/api/docs/security.md`: broken access control, inyección, errores criptográficos, misconfiguración, identificación/autenticación, integridad, registro, SSRF.
- **Abuso.** Límite por usuario: máximo 10 recetas y 50 comentarios por día, anti-spam.

## 8. Comportamiento de error, carga, vacío y recuperación

- **Carga inicial.** Frontend lazy-load por ruta. Skeletons en feed, detalle, perfil, plan. Imágenes con `<img loading="lazy" decoding="async" srcset>`.
- **Errores 5xx.** Toast con `traceId` para reportar. Reintento automático en GET idempotente (backoff exponencial 1, 2, 4 s). No reintento en POST salvo `Idempotency-Key`.
- **Errores 4xx.** Mensajes específicos por campo en formularios. 401 → modal «Sesión caducada» con refresh transparente.
- **Vacíos.** Cada pantalla con `EmptyState` definido: feed sin seguidos, búsqueda sin resultados (con sugerencias para relajar filtros), colección vacía, plan vacío (CTA «Explorar recetas»).
- **Recuperación.** Recetas en borrador: `localStorage` con TTL 7 días y `{ recetaId, payload }` para reanudar tras refresh o cierre del navegador.
- **Modo offline lectura.** Service Worker solo para lectura de receta visitada previamente (capabilities futuras). No se documenta en MVP; queda como deuda.
- **Concurrencia.** Versión optimista (`updatedAt` en Receta). En conflicto al editar, modal con diff básico y opción «mantener mío» o «mantener remoto».

## 9. Estrategia de despliegue y migraciones

- **Dockerfile único para API.** `Dockerfile` multi-stage: build TypeScript → distroless Node 20 en runtime. Imagen base etiquetada con `sha256`.
- **Variables de entorno validadas en arranque** con Zod: `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MAILER_*`, `IMAGE_STORE_*`. Cualquier ausencia es error fatal.
- **Migraciones.** Scripts `apps/api/db/migrations/*.ts` numerados. Migrador simple basado en `migrations` collection con checkpoint. Backfills idempotentes. Cambios compatibles hacia atrás primero (añadir campo con default, dual-write, lectura dual, retirar).
- **Rollout.** Estrategia blue/green en producción. Feature flags por contexto en `shared/flags`. La flag principal: `RECIPE_SOCIAL_V1` controla la disponibilidad de la red social para un cohorte.
- **Backups.** Snapshots Mongo diarios. Retención 30 días. Política de recuperación probada trimestralmente.

## 10. Secuencia de implementación por tajadas verificables

Cada tajada es un entregable verificable por separado. Se numeran para que QA y revisión las reconozcan.

### Tajada 0 — Andamiaje

1. Crear monorepo `apps/api` y `apps/web`. Estructura, scripts, ESLint, Prettier, Husky, lint-staged.
2. Configurar `tsconfig` con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Camino de build verde.
3. `docker-compose` con Mongo + Mailpit para dev. `.env.example` documentado.
4. Pipeline CI: lint + typecheck + tests en cada PR; build + deploy a entorno `preview` en `main`.

### Tajada 1 — Identidad

5. Modelos `User`, hashing Argon2id, JWT access + refresh opaco.
6. Endpoints registro, login, refresh, logout, forgot/reset, verificación email.
7. Frontend: páginas de registro, login, recuperación, verificación.
8. Middleware `requireAuth`, guard de Angular.
9. Tests: unit (casos válidos, inválidos), integration (flujo completo), e2e Cypress/Playwright de registro + login.

### Tajada 2 — Recetas (catálogo)

10. Modelos `Recipe`, validaciones de dominio, vocabulario de alérgenos y dietas sembrados.
11. Endpoints crear, editar, borrar, ver.
12. Frontend: asistente de creación por pasos, vista detalle, borrador persistente.
13. Subida de imágenes vía `ImageStore` filesystem.
14. Tests: invariantes de alérgenos, validación de borradores, recuperación tras refresh.

### Tajada 3 — Descubrimiento

15. Endpoints feed cronológico, búsqueda `$text`, filtros combinados, relacionadas.
16. Frontend: feed con scroll infinito, pantalla de búsqueda con filtros.
17. Página Open Graph de receta para compartir.
18. Tests: CA-02, CA-03 (set de 20 recetas con combinaciones de alérgenos).

### Tajada 4 — Social

19. Endpoints seguir/dejar de seguir; `GET /users/:id`.
20. Colecciones y guardado.
21. Comentarios (anidados un nivel) y valoraciones.
22. Frontend: perfil propio y ajeno, listas de colecciones, detalle con comentarios y rating.
23. Tests: idempotencia de guardado y valoración; concurrencia de comentarios.

### Tajada 5 — Planificación

24. Endpoints plan semanal y lista de compra (cálculo de consolidación).
25. Frontend: cuadrícula del plan y pantalla de lista con marcar comprado.
26. Exportación PDF/imprimir.
27. Tests: CA-04 (suma de ingredientes, no mezclar unidades no normalizables).

### Tajada 6 — Moderación

28. Endpoints de reporte.
29. Cola y panel de moderación.
30. Acciones ocultar/eliminar, auditoría.
31. Tests: trazabilidad, anonimización de cuenta.

### Tajada 7 — Endurecimiento y verificación final

32. Rate limiting, CSP, CORS, Helmet.
33. Auditoría de logs (sin PII), métricas básicas RED por ruta.
34. Pruebas e2e de aceptación (CA-01 a CA-07). Lighthouse mobile, axe-core para accesibilidad.
35. Backups probados, runbook actualizado.

### Notas sobre paralelización

- Las tajadas 1–7 son secuenciales porque comparten tipos y capas.
- Dentro de cada tajada, los endpoints y sus pantallas frontend pueden desarrollarse en paralelo por dos agents (`Desarrollador API` y `Desarrollador UI`) cuando los tipos están fijados en `apps/contracts`.
- Las verificaciones (subtareas marcadas como «Tests») entran en un grupo paralelo separado para no retrasar el grueso de cada tajada.

## 11. Riesgos, suposiciones y preguntas abiertas

### Suposiciones

- El backend será Node.js + Express + MongoDB (no Postgres). Si Jaime prefiere Postgres u otro stack, la arquitectura se ajusta manteniendo las mismas fronteras de bounded context.
- La UI será Angular con TypeScript, no React/Vue. Si se prefiere React, los contratos de `apps/contracts` se mantienen.
- En MVP no se persiste la lista de compra entre dispositivos; se vive en `localStorage`.
- No hay SLA formal ni objetivo de escala publicado. Las decisiones asumen < 100k recetas en catálogo activo.

### Riesgos

- **R1 — Filtrado por alérgenos.** Cobertura exhaustiva con set de prueba y revisión manual. Mitigación: tests de aceptación CA-03, redacción explícita en UI, vocabulario cerrado único.
- **R2 — Rendimiento del feed.** Con muchos seguidos el feed `seguidos` puede degradarse. Mitigación: feed cronológico simple con índice adecuado; cursor pagination; cache en Mongo de contadores.
- **R3 — Consolidación de ingredientes.** Errores de cálculo de listas de compra erosionan confianza. Mitigación: tests CA-04 con casos mixtos (g, ud, pizca).
- **R4 — Anonimización al borrar cuenta.** Datos residuales en logs, agregaciones. Mitigación: redacción + borrado lógico + anonimización verificada por script.
- **R5 — Subida de imágenes maliciosa.** SVG, EXIF, ejecutables renombrados. Mitigación: validación magic bytes, bloqueo SVG en MVP, virus scanner opcional futuro.
- **R6 — Acumulación de errores en borradores.** `localStorage` puede llegar a 5 MB. Mitigación: TTL 7 días y límite por receta; aviso al usuario.

### Preguntas abiertas a Jaime antes de implementar

1. ¿Confirmas el stack Node.js + Express + MongoDB + Angular, o prefieres Postgres en su lugar?
2. ¿La lista de compra debe sincronizarse entre dispositivos en MVP (requiere persistir)? Confío por defecto en `localStorage`.
3. ¿Hay algún proveedor de correo concreto preferido para producción (SendGrid, SES, Mailgun)?
4. ¿Cómo quieres manejar la foto de perfil: obrigatória o opcional al registrarse?
5. ¿Alguna restricción legal (RGPD, LSSI,cookies, etc.) que deba modelar ya en el MVP?

## 12. Estrategia de verificación

### Automatización

- **Unit (Jest, dominio y servicios).** Cubre reglas de negocio puras (consolidación de ingredientes, validación de alérgenos, invariantes de Receta).
- **Integration (Supertest + Mongo efímero).** Endpoints contra Mongo real en contenedor. Semilla mínima por test.
- **Angular component/service (Jest + Testing Library + HttpTestingController).** Cobertura en componentes dumb y servicios con cliente tipado.
- **E2E (Playwright).** Suites pequeñas por escenario crítico:
  - Registro → login → crear receta → verla en feed propio.
  - Filtrar por alérgeno «gluten» y comprobar que recetas que lo declaran no aparecen (CA-03).
  - Generar lista de compra desde plan con 5 recetas (CA-04).
  - Seguir a un usuario y verificar receta en feed «seguidos» (CA-05).

### Calidad y aceptación

- `npm run lint` y `npm run typecheck` en cada PR; fallan si no pasan.
- Tests unit/integration obligatorios en cada tajada; merge bloqueado si fallan.
- `axe-core` en CI para componentes compartidos.
- Lighthouse mobile en la página de detalle de receta y en el feed (`performance ≥ 80`, `a11y ≥ 95`).
- Cobertura objetivo: ≥ 80 % en `apps/api/src/modules/**`, ≥ 70 % en frontend, sin comparar cobertura global.
- Pruebas de contrato: contrato OpenAPI generado y validado en CI (`schemathesis` o equivalente).

### Verificación de seguridad

- `npm audit` automático en CI, bloquea fallos `high`.
- Análisis estático (`eslint-plugin-security`).
- Pruebas de inyección y autorización con payloads negativos.
- Comprobación manual de cabeceras y CSP tras despliegue.

### Verificación funcional por criterio de aceptación

| CA | Verificación |
|---|---|
| CA-01 | E2E Playwright cronometra registro+verificación+primera receta; objetivo < 10 min. |
| CA-02 | Test integration con set de recetas sembrado; comprueba orden secundario configurable. |
| CA-03 | Test integration con 20 recetas de combinaciones opuestas; valida `$nin` de alérgenos. |
| CA-04 | Test unit sobre servicio de lista de compra + E2E Playwright de generación. |
| CA-05 | E2E con dos cuentas; sigue y publica; visibilidad ≤ 1 min (asumido directo sin worker). |
| CA-06 | `axe-core` + navegación por teclado manual en suite Cypress/Playwright. |
| CA-07 | Lighthouse con viewports 360–1920 px. |

### Operación y entrega

- Despliegue a `preview` tras merge a `main` con URL pública efímera.
- Runbook inicial con los puntos de fallo típicos (rate limit, mongo down, storage lleno).
- Documentación en `docs/` con: `architecture.md`, `api.md`, `runbook.md`, `security.md`.
