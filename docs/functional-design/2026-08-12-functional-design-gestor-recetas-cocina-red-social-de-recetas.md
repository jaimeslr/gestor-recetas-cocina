# Functional Design — Gestor Recetas Cocina (Red social de recetas)

## 1. Cover

- Producto: **Gestor Recetas Cocina** — aplicación web tipo red social para publicar, descubrir y compartir recetas.
- Documento: Functional Design Report v1.0
- Estado: pendiente de aprobación del usuario
- Preparado por: Diseñador Funcional

## 2. Tabla de contenidos

1. Cover
2. Tabla de contenidos
3. Petición formalizada
4. Contexto e investigación
5. Usuarios y objetivos
6. Alcance funcional
7. Flujos principales
8. Mapa de navegación
9. Wireframes low-fi
10. Requisitos funcionales
11. Criterios de aceptación
12. Riesgos, asunciones y preguntas abiertas
13. Fuentes

## 3. Petición formalizada

> Construir una aplicación web tipo red social centrada en recetas de cocina. Las personas usuarias autenticadas pueden publicar recetas propias con ingredientes, pasos y foto, descubrir recetas de la comunidad mediante un feed cronológico y curado, comentar y puntuar, seguir a otras personas cocineras, guardar recetas en colecciones temáticas y planificar comidas semanales. Las recetas anónimas son legibles pero no publicables.

## 4. Contexto e investigación

### 4.1 Categoría de producto

El producto pertenece a la categoría de **red social de nicho** (contenido generado por el usuario alrededor de un dominio: recetas). No es un recetario personal (tipo Paprika) ni un planificador de comidas (tipo MealThinker). El corazón social son el feed, los perfiles, los seguidores y la interacción por receta.

### 4.2 Investigación realizada

- **Cookpad, SideChef, Tasty, Samsung Food, Peel**: consultados como referencia de funcionalidad moderna: importar receta desde URL o vídeo, escalas de porciones, comentarios con hilos, foto obligatoria, listas de compra, colecciones y planificación semanal.
- **Schema.org Recipe + Google Recipe structured data**: modelo de datos canónico para recetas publicado en la web (nombre, imagen, descripción, author, datePublished, prepTime, cookTime, recipeYield, recipeCategory, recipeCuisine, recipeIngredient, recipeInstructions, nutrition, aggregateRating, review). Se adopta como referencia para el modelo de datos.
- **Buenas prácticas de redes sociales de nicho**: feed cronológico + ranked, seguir/dejar de seguir, like y guardar como dos primitivos independientes, moderación de comentarios, perfil público con bio y contador de recetas y seguidores.

### 4.3 Decisiones derivadas de la investigación

1. Adopción parcial del modelo Recipe de schema.org para máxima consistencia con importadores y con SEO.
2. Dos primitivos de engagement separados: **like** (reacción pública) y **guardar** (bookmark privado en colecciones).
3. Feed híbrido: cronológico para seguir a personas concretas + curated/descubrimiento para novedades.
4. Roles diferenciados desde el primer release: lector anónimo, miembro, moderador (solo si el equipo lo necesita — fuera de alcance v1).
5. Importar receta por URL como diferenciador de v1 (no es trivial y aporta valor desde el día 1).

## 5. Usuarios y objetivos

| Persona | Descripción | Necesidades |
|---|---|---|
| Lector anónimo | Visita la app sin cuenta | Explorar recetas trending, ver perfiles públicos, leer recetas, registrarse para interactuar |
| Cocinera creadora | Publica recetas propias y sigue a otras personas | Editor cómodo con foto y pasos, ver likes y comentarios en sus recetas, métricas en su perfil |
| Cocinera seguidora | Guarda recetas, planifica comidas y comenta | Feed personalizado, colecciones, lista de compra, planificador semanal |
| Moderador (fuera de alcance v1) | Gestiona reportes | Back-office de moderación |

Objetivos de negocio del MVP: adquisición (descubrimiento de recetas públicas), retención (feed, seguir, planificar), contenido (fricción mínima al publicar).

## 6. Alcance funcional

### 6.1 Dentro de alcance (v1)

- Registro, login y logout con email + contraseña (almacenamiento seguro de hash).
- Perfil público con avatar, bio, contador de recetas, seguidores y seguidos.
- Publicar receta: título, descripción, foto principal, ingredientes (cantidad + unidad + nombre en líneas estructuradas), pasos numerados con texto y foto opcional, tiempo (preparación, cocción, total), porciones, categoría, tipo de cocina, etiquetas, dificultad, apto para (sin gluten, vegetariano, vegano).
- Editar y borrar recetas propias (soft delete: oculta receta, conserva historial).
- Detalle de receta con: foto, ingredientes en columnas escalables por porciones, pasos numerados, tiempos, rating promedio, lista de comentarios, botones de like, guardar y compartir.
- Feed principal cronológico (siguiendo) y pestaña de descubrimiento (tendencias + categorías).
- Comentarios anidados a un nivel (1 reply por comentario).
- Rating con estrellas 1–5, una sola vez por persona y receta, editable.
- Guardar receta en una colección (crear colección nueva o seleccionar existente).
- Seguir / dejar de seguir a otra persona.
- Buscar recetas por texto, filtro por categoría, tipo de cocina, tiempo máximo y dieta.
- Planificador semanal: arrastrar recetas a días desayuno/almuerzo/cena de la semana en curso.
- Lista de compra agregada a partir de las recetas planificadas en la semana.
- Notificaciones in-app: like, comentario, nuevo seguidor.

### 6.2 Fuera de alcance (v1)

- Vídeo paso a paso, stories, chat 1:1.
- Importación automática desde URL (queda como wishlist v1.1).
- Integraciones externas (Google Shopping, Alexa, planificadores third-party).
- App móvil nativa.
- Roles de moderador y herramientas back-office.
- Marketplace de ingredientes.

## 7. Flujos principales

### 7.1 Flujo: Registro y primer login

1. Usuario entra a `/register`.
2. Completa email, contraseña, nombre de usuario, nombre a mostrar.
3. Sistema valida email único y contraseña mínima de 8 caracteres.
4. Se crea cuenta y redirige a feed `/`.
5. Perfil vacío: CTA "Publica tu primera receta".

### 7.2 Flujo: Publicar receta

1. Miembro autenticado hace clic en "Publicar receta" (botón global).
2. Llega a `/recipes/new` con editor por secciones colapsables.
3. Rellena: foto (obligatoria), título, descripción, tiempos, porciones, dificultad, categoría, tipo de cocina, etiquetas, ingredientes estructurados, pasos numerados.
4. Pulsa "Guardar".
5. Sistema valida campos obligatorios y publica la receta.
6. Redirige a `/recipes/{id}` en estado público.
7. Notifica a seguidores via in-app.

### 7.3 Flujo: Descubrir e interactuar

1. Usuario llega a `/feed`.
2. Feed cronológico (siguiendo) por defecto, pestaña "Descubrir" muestra tendencias.
3. Toca una receta → detalle `/recipes/{id}`.
4. Puede like, comentar, guardar en colección, ajustar porciones (escala ingredientes) o pulsar "Planificar esta receta" → modal con día y comida.

### 7.4 Flujo: Planificar semana y generar lista de compra

1. Miembro abre `/planner`.
2. Vista semanal 7 columnas × 3 filas (desayuno/almuerzo/cena).
3. Desde el catálogo de recetas guardadas, asigna cada hueco.
4. Pulsa "Generar lista de la compra": se consolidan ingredientes iguales por nombre, sumando cantidades con conversión de unidades cuando aplica; las no convertibles se listan tal cual.
5. Lista exportable a `/shopping-list` para imprimir o compartir.

## 8. Mapa de navegación

```
[Anon]
  /login ─────────────────────────────┐
  /register ───────────────────────┐ │
  /feed (vista pública trending) ──┐│ │
  /recipes/:id (lectura) ──────────┐│ │
  /u/:username (perfil público) ────┐│ │
                                    ││ │
                                    ▼▼ ▼
                              [Miembro autenticado]
                                    │
        ┌──────────────┬─────────────┼──────────────┬──────────────┐
        ▼              ▼             ▼              ▼              ▼
    /feed (siguiendo) /recipes/new /search       /planner    /me (perfil propio)
        │              │             │              │              │
        │              │             │              ▼              │
        │              │             │          /shopping-list    │
        ▼              ▼             ▼                            ▼
     /recipes/:id   /recipes/:id/edit                       /me/collections
        │              │                                     /me/followers
        ▼              ▼                                     /me/following
   /u/:author
```

Estados relevantes por pantalla: vacío (sin recetas seguidas / sin publicaciones), error, carga.

## 9. Wireframes low-fi

### 9.1 Home / Feed (`/feed`)

```
+---------------------------------------------------------------+
| LOGO  Buscar [.............]    Publicar   Notif  Avatar       |
+---------------------------------------------------------------+
| [Siguiendo] [Descubrir]                                        |
+---------------------------------------------------------------+
| Tarjeta de receta                                              |
| +-------------------+  Título de la receta                     |
| |     FOTO          |  por @autor        4.6★ (32)            |
| |                   |  -----------------------------          |
| +-------------------+  ⏱ 25 min  · 👥 4 porciones  · 🌶 fácil  |
| ♥ 12   💬 3   🔖 guardar   ⤴ compartir                        |
+---------------------------------------------------------------+
| Tarjeta de receta                                              |
| ... repetir ...                                                |
+---------------------------------------------------------------+
```

### 9.2 Detalle de receta (`/recipes/:id`)

```
+---------------------------------------------------------------+
| < Volver al feed                                               |
+----------------------+----------------------------------------+
|                      | TÍTULO DE LA RECETA                     |
|     FOTO PRINCIPAL   | por @autor  · 4.6★ (32)                |
|                      | ⏱ prep 15 + coc 25  · 👥 4 porciones    |
|                      | [♥] [💬] [🔖 Guardar] [⤴] [Planificar]  |
+----------------------+----------------------------------------+
| Tabs:  [Ingredientes]  [Pasos]  [Comentarios]  [Nutrición]    |
+---------------------------------------------------------------+
| Ingredientes                  | Pasos                          |
| Porciones [ -  4  + ]         | 1. Texto del paso (foto?)       |
|  - 200 g harina               | 2. Texto del paso               |
|  - 2 huevos                  | ...                             |
+---------------------------------------------------------------+
| Comentarios                                                   |
| @user  ★★★★★  "Comentario"            [Responder]            |
|   └ @autor  "Respuesta"              [Responder]              |
| [Escribir comentario ........]  [Enviar]                      |
+---------------------------------------------------------------+
```

### 9.3 Editor de receta (`/recipes/new` y `/recipes/:id/edit`)

```
+---------------------------------------------------------------+
| Publicar nueva receta                        [Guardar] [×]    |
+---------------------------------------------------------------+
| ▼ Foto principal  [ Subir ]   (obligatoria)                   |
| ▼ Datos básicos     Título [............] Descripción [.....]  |
| ▼ Tiempos y meta    Prep [  ] Cocción [  ] Porciones [ ]       |
|                     Dificultad [Fácil/Medio/Difícil]          |
| ▼ Categoría          [Tipo de cocina v] [Categoría v]        |
|                     Etiquetas [ chip chip chip + ]            |
|                     Apto para [☐ Vegano ☐ Sin gluten ... ]   |
| ▼ Ingredientes       + Añadir ingrediente                     |
|   | cantidad | unidad | nombre                | × |           |
| ▼ Pasos              + Añadir paso                            |
|   1. [texto...............................]  [foto?]  [↑↓×]   |
+---------------------------------------------------------------+
```

### 9.4 Planificador (`/planner`)

```
+---------------------------------------------------------------+
| Planificador semana del 12 al 18                     [⤓ Lista] |
+---------------------------------------------------------------+
|          Lun  Mar  Mié  Jue  Vie  Sáb  Dom                    |
| Desayuno [  ] [  ] [  ] [  ] [  ] [  ] [  ]                    |
| Almuerzo [  ] [  ] [  ] [  ] [  ] [  ] [  ]                    |
| Cena     [  ] [  ] [  ] [  ] [  ] [  ] [  ]                    |
+---------------------------------------------------------------+
| Recetas guardadas (catálogo lateral)                          |
| +------------------+                                           |
| |  FOTO  Título    |  (arrastrar a una celda)                 |
| |  ⏱ tiempo  ★4.5  |                                           |
| +------------------+                                           |
+---------------------------------------------------------------+
```

### 9.5 Perfil público (`/u/:username`)

```
+---------------------------------------------------------------+
| AVATAR  Nombre  @username  [Seguir]                            |
| Bio: Texto corto                                              |
| 24 recetas  ·  312 seguidores  ·  87 seguidos                  |
+---------------------------------------------------------------+
| [Recetas] [Colecciones]                                       |
| Grid 3×N                                                       |
| [foto][foto][foto]                                            |
| [foto][foto][foto]                                            |
+---------------------------------------------------------------+
```

### 9.6 Vista móvil (drawer)

```
+----------------------------+
| LOGO   🔍   🔔   Avatar     |
+----------------------------+
|        FEED ...             |
+----------------------------+
| Tapping avatar abre drawer:
|   Perfil   Planner  Mis rec.
|   Guardado  Notif   Cerrar ses.
+----------------------------+
```

## 10. Requisitos funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Registro y login con email y contraseña (hash seguro, mínimo 8 caracteres) | Alta |
| RF-02 | Editar perfil: avatar, bio, nombre a mostrar | Media |
| RF-03 | Publicar receta con foto obligatoria, ingredientes estructurados y pasos numerados | Alta |
| RF-04 | Editar y borrar recetas propias | Alta |
| RF-05 | Detalle de receta con escalado de porciones y pestañas (Ingredientes/Pasos/Comentarios/Nutrición) | Alta |
| RF-06 | Feed cronológico de seguidos y pestaña Descubrir (tendencias) | Alta |
| RF-07 | Comentarios anidados a un nivel | Alta |
| RF-08 | Rating 1–5 editable, una vez por receta y persona | Alta |
| RF-09 | Guardar receta en colección, crear colección nueva | Alta |
| RF-10 | Seguir y dejar de seguir, contador y listado público | Alta |
| RF-11 | Buscar por texto con filtros (categoría, tipo, dieta, tiempo máximo) | Alta |
| RF-12 | Planificador semanal 7×3 con asignación de recetas | Media |
| RF-13 | Lista de la compra agregada a partir de semana planificada | Media |
| RF-14 | Notificaciones in-app para like, comentario, nuevo seguidor | Media |
| RF-15 | Compartir receta por enlace público | Baja |
| RF-16 | Soft delete de recetas y cuentas | Baja |

## 11. Criterios de aceptación

| CA | Criterio | Verificable cuando... |
|---|---|---|
| CA-01 | Una persona sin cuenta puede leer recetas, perfiles y feed trending | Navegación anónima muestra 10 recetas trending sin error |
| CA-02 | Una receta publicada aparece en el feed de sus seguidores en ≤ 5s | El seguidor A publica y el seguidor B la ve al recargar |
| CA-03 | Likes y ratings se contabilizan correctamente y no se duplican por la misma persona | Una persona likea dos veces: el contador queda igual al estado tras el primer like |
| CA-04 | Escalar porciones ajusta los ingredientes visibles | 4→8 porciones duplica cantidades de forma legible |
| CA-05 | Comentar y responder a un comentario funciona | Comentario raíz + 1 respuesta anidada visibles en orden cronológico |
| CA-06 | Guardar en colección añade la receta y es visible en `/me/collections` | Tras guardar, "Mis colecciones" lista la receta |
| CA-07 | Seguir incrementa el contador del seguido y aparece en el feed del seguidor | Tras seguir, el feed cronológico muestra recetas recientes del seguido |
| CA-08 | Buscar por texto filtra correctamente | "pollo" devuelve solo recetas cuyo título/descripción/ingrediente contiene "pollo" |
| CA-09 | Planificar semana + generar lista agrega ingredientes iguales | Planificar dos recetas con "200g de arroz" produce "400g de arroz" en la lista |
| CA-10 | Soft delete oculta receta del detalle y listados pero conserva URL para autor | La receta borrada devuelve 410 al público y 200 al autor con banner |
| CA-11 | Todas las páginas renderizan correctamente en móvil (≤ 480px) | Auditoría visual sin desbordes en iPhone SE |

## 12. Riesgos, asunciones y preguntas abiertas

### 12.1 Riesgos

- **Duplicidad y abuso en comentarios**: requiera moderación rápida. Mitigación inicial: rate limit por persona y reportes básicos.
- **Conversión de unidades en lista de compra**: unidades no estandarizadas (tazas, pizcas) generarán entradas separadas. Mitigación: solo consolidar unidades estándar.
- **Planificador semana**: sin recordatorios push puede perder uso. Mitigación: notificaciones in-app + email semanal opcional.

### 12.2 Asunciones

- La primera versión es web responsive; no se prioriza PWA offline.
- Idioma de la UI: español por defecto (alineado con el proyecto "Gestor Recetas Cocina").
- El editor de recetas admite texto plano sin rich text complejo (sin tablas ni imágenes inline en texto).
- La primera versión asume almacenamiento local (SQLite embebido) más que un servicio externo de Postgres gestionado.

### 12.3 Preguntas abiertas

1. ¿Quieres que el idioma de la interfaz sea solo español o también inglés desde el inicio?
2. ¿La importación de receta por URL entra en v1 o la dejamos como v1.1?
3. ¿El planificador debe emitir notificaciones o quedarse como vista pasiva?
4. ¿Los roles de moderador entran en v1 o se reservan a una fase posterior?
5. ¿Qué nivel de riqueza necesitas en métricas (autor de receta): solo contadores o también tiempo medio de visita y conversión de guardado?

## 13. Fuentes

- **Schema.org Recipe** — modelo canónico de receta para la web. Adoptado como referencia para campos y tipos.
- **Google Search Central — Recipe structured data** — requisitos para rich results; apoya la decisión de estructurar ingredientes y pasos.
- **Nutrola — Top 10 Recipe Apps 2026: Features & Pricing Compared** — comparativa de categorías funcionales presentes en aplicaciones de receta maduras.
- **Food Digital — Top 10: Smart Recipe Providers** — panorama de plataformas tipo Cookpad, SideChef, Tasty, Samsung Food.
- **Peel — Best Yummly alternatives 2026** — cobertura de la tendencia de importadores sociales y meal planning.

## Fuentes
- [Schema.org Recipe](https://schema.org/Recipe) - Modelo canónico de datos de receta adoptado para el modelo funcional.
- [Google Search Central — Recipe structured data](https://developers.google.com/search/docs/appearance/structured-data/recipe) - Requisitos oficiales de Google para mostrar recetas como rich result; justifica estructurar ingredientes y pasos.
- [Nutrola — Top 10 Recipe Apps 2026: Features & Pricing Compared](https://nutrola.app/en/blog/top-10-recipe-apps-2026-features-pricing-compared) - Comparativa funcional de aplicaciones de receta actuales; valida nuestro alcance (feed, colecciones, planner, social).
- [Food Digital — Top 10: Smart Recipe Providers](https://fooddigital.com/top10/top-10-smart-recipe-providers) - Panorama de Cookpad, SideChef, Tasty y Samsung Food; aporta contexto de mercado.
- [Peel — Best Yummly alternatives 2026](https://trypeel.app/blog/best-yummly-alternatives-2026) - Confirma la tendencia de importadores sociales y meal planning como diferenciadores.
