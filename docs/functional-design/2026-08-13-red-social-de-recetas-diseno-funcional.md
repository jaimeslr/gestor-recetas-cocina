# Red social de recetas — Diseño funcional

## Tabla de contenidos

1. Petición original
2. Petición formalizada
3. Investigación y contexto
4. Objetivos funcionales
5. Usuarios y casos de uso
6. Alcance incluido y excluido
7. Requisitos funcionales
8. Flujos principales
9. Mapa de navegación
10. Wireframes funcionales de baja fidelidad
11. Datos, entidades y contenido
12. Integraciones y dependencias funcionales
13. Criterios de aceptación
14. Riesgos, suposiciones y preguntas abiertas
15. Fuentes

---

## 1. Petición original

> «hazme una red social de recetas»

Petición breve y deliberadamente abierta. No aporta público objetivo, mercado, idioma, modelo de negocio ni nivel de profundidad.

---

## 2. Petición formalizada

Construir una **plataforma social web** centrada en recetas de cocina donde personas usuarias registradas publican recetas propias, descubren recetas de otras personas, las guardan, las valoran, las comentan, siguen a otras personas cocineras y organizan su cocina con planificación semanal y lista de compra.

Funcionalidad nuclear mínima viable:

- Descubrimiento: feed personalizado, búsqueda por texto, filtros por dieta y alérgenos, categorías y dificultad.
- Publicación: alta de receta con ingredientes, pasos, fotos, tiempos, raciones, dificultad, etiquetas de dieta y alérgenos.
- Social: seguir a personas cocineras, guardar recetas en colecciones, comentar, valorar, compartir.
- Organización: planificación semanal de comidas y lista de compra generada a partir del plan.
- Cuenta: perfil público con biografías, foto, recetas, seguidores, seguidos.

Quedan fuera del MVP: aplicación móvil nativa, monetización y suscripciones, recomendaciones algorítmicas complejas, integración con supermercados o superasistentes.

Idioma de la interfaz: **español**. Posibilidad futura de añadir inglés sin refactor de textos.

---

## 3. Investigación y contexto

El mercado de apps de recetas se encuentra en crecimiento sostenido y el componente social explica una parte significativa del engagement: casi la mitad de las interacciones en apps de食谱 están impulsadas por funciones sociales, mientras que más del 60% de los usuarios las usan para tomar decisiones de alimentación saludable. Esto avala que la diferenciación no debe venir solo del catálogo, sino de la **comunidad**.

En plataformas existentes se observa un patrón compartido: navegación por feeds, tarjetas de receta con imagen dominante, guardado, rating y comentarios. El modelo de datos suele apoyarse en entidades Receta, Ingrediente, Paso, Etiqueta, Alérgeno, Dieta, Usuario, Comentario, Valoración, Seguidor, Colección y PlanSemanal.

Los alérgenos no pueden tratarse como una etiqueta cosmética: son una **función de confianza**. La práctica recomendada es modelarlos como dato auditable, no como búsqueda difusa, y utilizar un vocabulario canónico controlado. Esto condiciona el diseño de filtros y avisos.

La planificación semanal y la generación automática de lista de compra son funcionalidades que aportan valor de retención más allá del catálogo y de la red social: convierten el contenido social en una **herramienta cotidiana**.

> Suposición: el usuario quiere un producto funcional de uso general, no un prototipo académico. El alcance «red social» lleva a incluir seguir/guardar/valorar; el resto (plan semanal y lista de compra) se incorpora porque es donde la app de recetas se convierte en hábito, no solo inspiración.

---

## 4. Objetivos funcionales

- **OG-1 Descubrir**. Una persona usuaria nueva puede encontrar recetas relevantes en menos de tres interacciones desde la pantalla de inicio.
- **OG-2 Publicar**. Una persona usuaria puede crear y compartir una receta completa en menos de 5 minutos guiada por el formulario.
- **OG-3 Socializar**. Una persona usuaria puede seguir a otra, guardar, comentar y valorar una receta, y ver estas acciones reflejadas en su feed y en el de su comunidad.
- **OG-4 Organizar**. Una persona usuaria puede planificar las comidas de la semana y obtener la lista de compra consolidada para todos los días planificados.
- **OG-5 Confiar**. Toda receta publicada declara alérgenos y dietas de forma explícita y los filtros se aplican de forma conservadora.
- **OG-6 Acceder**. La plataforma es usable desde navegador moderno en móvil y escritorio, con rendimiento aceptable en conexiones estándar.

---

## 5. Usuarios y casos de uso

### Personas

- **Lucía — cocinera hogareña**. Publica sus recetas familiares, busca inspiración para el día a día, valora otras recetas.
- **Iván — cocinero aficionado**. Sigue a otros usuarios, guarda recetas en colecciones temáticas (sopas, batch cooking) y planifica la semana.
- **Ana — usuaria con restricciones**. Solo consume recetas sin gluten y sin frutos secos. Necesita poder filtrar y confiar en las etiquetas.
- **Marta — invitada**. Llega desde un enlace compartido, puede leer una receta, comentar y guardar, y se le invita a registrarse.

### Casos de uso (CU)

- CU-1 Registrarse e iniciar sesión.
- CU-2 Completar perfil público (avatar, bio, nombre público).
- CU-3 Crear receta con ingredientes, pasos, foto, etiquetas, dieta y alérgenos.
- CU-4 Editar y borrar recetas propias.
- CU-5 Buscar y filtrar recetas por texto, dieta, alérgeno, dificultad, tiempo.
- CU-6 Ver receta completa con comentarios y relacionados.
- CU-7 Guardar receta en colección y quitar de colección.
- CU-8 Crear y renombrar colecciones.
- CU-9 Seguir y dejar de seguir a otra persona.
- CU-10 Comentar y responder comentarios.
- CU-11 Valorar receta con puntuación 1–5.
- CU-12 Compartir receta por enlace.
- CU-13 Planificar comidas en una semana (desayuno, comida, cena, snack).
- CU-14 Generar lista de compra desde el plan semanal.
- CU-15 Reportar receta o comentario por contenido inapropiado.
- CU-16 Moderar contenido propio y ajeno (solo cuenta con rol moderador).

---

## 6. Alcance incluido y excluido

### Incluido en MVP

- Registro y autenticación (email + contraseña con verificación, recuperación por email).
- Perfil público editable.
- Alta, edición y borrado de recetas con imagen subida, ingredientes estructurados, pasos numerados, tiempos, raciones, dificultad, dieta y alérgenos.
- Búsqueda por texto y filtros por dieta, alérgeno, dificultad, tiempo máximo, categoría.
- Feed cronológico y feed «seguidos».
- Detalle de receta con ingredientes, pasos, comentarios, valoración media y «recetas relacionadas».
- Guardar en colecciones y gestionar colecciones.
- Seguir/dejar de seguir con efecto en feed.
- Comentarios anidados a un nivel (1 respuesta).
- Valoración 1–5 con media visible.
- Compartir por enlace público.
- Planificación semanal por usuario con comidas Desayuno/Comida/Cena/Snack.
- Generación de lista de compra consolidada desde el plan.
- Reporte de contenido y papelera de moderación.
- Panel de moderación con acciones (ocultar, eliminar, advertir).

### Explícitamente fuera del MVP

- Aplicación móvil nativa.
- Inicio de sesión social (Google, Apple, Facebook) y SSO empresarial.
- Pasarela de pago, suscripciones premium o tienda.
- Notificaciones push y correo transaccional masivo más allá de verificación y recuperación.
- Recomendación algorítmica basada en ML; en MVP basta con «relacionadas por etiqueta».
- Internacionalización completa; en MVP solo español.
- Integración con supermercados, asistentes de voz o comercio electrónico.
- Vídeos en receta (en MVP solo imágenes).
- Mensajería privada entre usuarios.

---

## 7. Requisitos funcionales

Cada requisito es verificable y observable por la persona usuaria final.

### Autenticación y cuenta

- **RF-01** Registro con email único, contraseña con mínimo 8 caracteres, mayúsculas/minúsculas y número; verificación por correo antes de poder publicar.
- **RF-02** Inicio de sesión con email + contraseña y persistencia de sesión.
- **RF-03** Recuperación de contraseña por enlace enviado al correo.
- **RF-04** Edición de perfil: foto, nombre público, biografía, país opcional.
- **RF-05** Baja de cuenta desde ajustes con confirmación y eliminación lógica (contenido anonimizado).

### Recetas

- **RF-10** Crear receta con: título (5–80 caracteres), descripción (máx. 500), imagen principal (obligatoria), categoría, tiempo de preparación, tiempo de cocción, raciones (1–20), dificultad (Fácil/Media/Difícil), ingredientes (mínimo 1, cada uno con nombre, cantidad, unidad), pasos numerados (mínimo 1, máx. 300 caracteres por paso), etiquetas de dieta (0..n) y alérgenos presentes (0..n).
- **RF-11** Validación de campos obligatorios; el formulario guarda borrador local para evitar pérdida.
- **RF-12** Borrador se puede publicar y volver a editar tras la publicación.
- **RF-13** Borrado con confirmación; las recetas borradas dejan de ser accesibles y sus comentarios se conservan anonimizados.
- **RF-14** Detalle de receta muestra: imagen principal, autor (con enlace a perfil), tiempo total, raciones, dificultad, ingredientes clicables para añadir al plan, pasos numerados, valoración media, comentarios, y acciones Guardar/Compartir/Reportar.
- **RF-15** Relación «ingredientes relacionados» ofrece alternativas solo en MVP si la etiqueta coincide.

### Descubrimiento y filtros

- **RF-20** Búsqueda por texto en título, descripción e ingredientes; sin acentos ni mayúsculas.
- **RF-21** Filtro obligatorio de alérgenos por exclusión: seleccionar alérgenos que se desea evitar excluye recetas que los contengan; la UI hace explícito este contrato.
- **RF-22** Filtros combinables: dieta (múltiple), tiempo máximo, dificultad, categoría, raciones mínimas.
- **RF-23** Orden: más recientes, más valoradas, más guardadas.
- **RF-24** Feed de inicio: cronológico general. Feed «Seguidos»: solo recetas de personas seguidas, en orden cronológico inverso.
- **RF-25** Paginado por scroll infinito con lotes de 20, sin saltos visibles.

### Social

- **RF-30** Seguir/dejar de seguir con confirmación; los recuentos de seguidores y seguidos son visibles en el perfil.
- **RF-31** Guardar receta en una colección predeterminada «Favoritas» o en otra creada por la persona.
- **RF-32** Crear, renombrar y borrar colecciones; arrastrar receta entre colecciones.
- **RF-33** Comentar con texto de 1–500 caracteres; una respuesta por comentario máximo en MVP.
- **RF-34** Valorar receta con 1–5 estrellas; solo una valoración por usuario y receta.
- **RF-35** Compartir por enlace con Open Graph para mostrar imagen, título y autor en redes.

### Organización

- **RF-40** Plan semanal en cuadrícula 7 días × 4 tipos de comida.
- **RF-41** Asignar receta del catálogo a una celda; las raciones por defecto son las de la receta y se pueden ajustar.
- **RF-42** Lista de compra consolidada: suma de ingredientes del plan agrupada por nombre, respetando unidad (g, ml, ud, etc.).
- **RF-43** Marcar ingredientes de la lista como «comprados»/«pendientes» y exportar/imprimir.

### Moderación y seguridad

- **RF-50** Reporte de receta o comentario con motivo; cada elemento reportado pasa a cola de moderación.
- **RF-51** Panel de moderación accesible solo a cuentas con rol moderador; acciones: aprobar, ocultar, eliminar.
- **RF-52** Privacidad por defecto: el contenido publicado es público. Borradores son privados.

### Accesibilidad y rendimiento

- **RF-60** Cumplimiento básico WCAG AA: contraste mínimo 4.5:1, foco visible, etiquetas en formularios, navegación por teclado completa.
- **RF-61** Responsive desde 360px de ancho hasta escritorio amplio.
- **RF-62** Primera vista de receta principal en menos de 2,5 s en 3G estable.

---

## 8. Flujos principales

### Flujo A — Publicar receta

1. La persona usuaria autenticada pulsa «Crear receta».
2. Aparece un formulario por pasos (Datos básicos → Imagen → Ingredientes → Pasos → Dietas y alérgenos → Vista previa → Publicar).
3. En cualquier paso puede «Guardar borrador». El estado se persiste localmente y se recupera al volver.
4. Al finalizar, la receta se publica y queda accesible desde su perfil y los feeds correspondientes.

### Flujo B — Descubrir y guardar receta

1. La persona accede a Inicio; ve el feed.
2. Aplica filtros por alérgenos a evitar, dieta y tiempo.
3. El feed se reduce a las recetas que cumplen todos los filtros simultáneamente.
4. La persona entra al detalle, valora, comenta y guarda en una colección.

### Flujo C — Plan semanal y lista de compra

1. En «Mi semana», ve la cuadrícula vacía.
2. Busca receta o la elige desde una de sus colecciones/guardadas y la asigna a una celda.
3. Ajusta raciones si difiere de la receta original.
4. Pulsa «Generar lista de compra» y ve los ingredientes sumados por producto.
5. Marca productos comprados o exporta la lista.

### Flujo D — Seguir a otra persona

1. Desde el detalle de receta o el perfil, pulsa «Seguir».
2. La acción es inmediata; el conteo de seguidores se actualiza sin recargar.
3. Sus recetas pasan a su feed «Seguidos» desde el momento del seguimiento.

---

## 9. Mapa de navegación

```
[Inicio]
  ├─ Feed cronológico
  ├─ Feed «Seguidos»
  ├─ Atajos: Recetas destacadas, Categorías, Dietas
[Búsqueda]
  ├─ Barra de búsqueda + filtros (alérgenos, dieta, tiempo, dificultad, categoría)
  └─ Resultados (lista de recetas)
[Crear]
  ├─ Asistente por pasos
  └─ Vista previa → Publicar
[Detalle de receta]
  ├─ Acciones: Guardar, Compartir, Reportar
  ├─ Comentarios y respuestas
  ├─ Valoración
  └─ Relacionadas
[Mi perfil]
  ├─ Recetas publicadas
  ├─ Colecciones (con recetas guardadas)
  ├─ Plan semanal
  ├─ Lista de compra
  ├─ Seguidores / Seguidos
  └─ Ajustes
[Perfil de otra persona]
  ├─ Botón Seguir/Dejar de seguir
  ├─ Recetas publicadas
  ├─ Colecciones públicas
[Autenticación]
  ├─ Registro
  ├─ Inicio de sesión
  ├─ Recuperación
  └─ Verificación de correo
[Moderación] (solo rol moderador)
  ├─ Cola de reportes
  └─ Histórico de acciones
```

---

## 10. Wireframes funcionales de baja fidelidad

### 10.1 Inicio / Feed

```
+-------------------------------------------------------+
| [Logo] [Buscar...]   [Inicio] [Crear] [Perfil] [Salir] |
+-------------------------------------------------------+
| Filtros rápidos: [Alérgenos a evitar v] [+ Dietas]    |
| [+ Tiempo] [+ Dificultad] [+ Categoría]               |
+-------------------------------------------------------+
| [Foto] | [Foto] | [Foto]                             |
| Título | Título | Título                             |
| autor  | autor  | autor                               |
| ★ 4.6  | ★ 4.3  | ★ 4.8                             |
| [Guardar] [Valorar]                                  |
+-------------------------------------------------------+
|  ...scroll infinito (lotes de 20)...                  |
+-------------------------------------------------------+
```

### 10.2 Detalle de receta

```
+---------------------------------------------------------+
| [Foto principal]                                        |
+---------------------------------------------------------+
| Título de la receta                       [Guardar] [⋮] |
| Por @autor · ★ 4.6 (124) · 30 min · Fácil · 4 rac.     |
| Etiquetas: [Vegana] [Sin gluten]                       |
| Dietas: Vegetariana, Vegana                             |
| Alérgenos declarados: ninguno                           |
+---------------------------------------------------------+
| Columna izquierda       | Columna derecha               |
| INGREDIENTES            | PASOS                         |
| - 200 g de ... [Añadir] | 1. ...                         |
| - 1 cdita de ...        | 2. ...                         |
| - ...                   | 3. ...                         |
+-------------------------+--------------------------------+
| COMENTARIOS                                              |
| @usuario: "..."     [Responder]                          |
|   ↳ @otro: "..."                                        |
| [Escribir comentario (1–500 caracteres)] [Publicar]      |
+---------------------------------------------------------+
```

### 10.3 Crear receta — asistente

```
[ Paso 1: Datos básicos ]
Título: [______________]
Descripción: [______________]
Categoría: [Desayuno v]
Tiempo prep: [__ min]  Tiempo cocción: [__ min]
Raciones: [__]  Dificultad: [Fácil v]

[ Anterior (deshabilitado) ]   [ Guardar borrador ]   [ Siguiente ]

        Paso: ● ○ ○ ○ ○ ○
```

### 10.4 Plan semanal

```
         Lun  Mar  Mié  Jue  Vie  Sáb  Dom
Desay.  [ + ] [rec][ + ] [rec][ + ] [rec][ + ]
Comida  [rec][rec][ + ] [rec][rec][ + ] [rec]
Cena    [ + ] [rec][rec][ + ] [rec][rec][rec]
Snack   [ + ] [ + ] [ + ] [ + ] [ + ] [ + ][ + ]

[ Generar lista de compra ]   [ Exportar ]
```

### 10.5 Lista de compra

```
[ ] Aceite de oliva ............ 60 ml
[x] Tomate triturado ........... 800 g
[ ] Cebolla .................... 3 ud
[ ] Ajo ........................ 6 dientes
[ ] ... (lista completa)

[ Imprimir ]  [ Exportar ]  [ Vaciar marcados ]
```

### 10.6 Perfil de persona

```
[Avatar] Nombre público
         @usuario · Sevilla (opcional)
         Bio de 1–3 líneas.
[Seguir] [Mensaje — fuera de MVP]
---------------------------------------------------------
 Recetas          Colecciones        Plan         Lista
---------------------------------------------------------
[Foto][Foto][Foto] ...
"Mejor día con esta receta" — @seguidor
```

### 10.7 Pantallas vacías y de error relevantes

- **Feed vacío (usuario nuevo)** con texto «Aún no sigues a nadie. Explora recetas para empezar».
- **Sin resultados de búsqueda** con sugerencias y atajos para relajar filtros.
- **Receta sin valor** con mensaje «Sé la primera persona en probarla y dejar tu valoración».
- **Estado de error en formulario de receta** mostrando los campos con problema y mensajes específicos.

---

## 11. Datos, entidades y contenido

### Vocabularios cerrados

- **Alérgenos canónicos** (alineados con normativa UE): gluten, crustáceos, huevos, pescado, cacahuetes, soja, leche, frutos de cáscara, apio, mostaza, sésamo, sulfitos, moluscos, altramuces.
- **Dietas**: vegetariana, vegana, sin gluten, sin lactosa, baja en carbohidratos, keto, mediterránea, pescetariana, halal, kosher.
- **Categorías**: desayuno, comida, cena, snack, postre, bebida, salsa, guarnición, panadería.
- **Dificultad**: Fácil, Media, Difícil.
- **Unidades**: g, kg, ml, l, ud, cdita, cdta, taza, pizca, diente, rebanada.

### Modelo de entidades (resumen funcional)

- **Usuario**: id, email, hashContraseña, nombre público, avatar, bio, país opcional, fechaAlta, rol.
- **Receta**: id, autor, título, descripción, imagenPrincipal, categoría, tiempoPrep, tiempoCocción, raciones, dificultad, dietas[], alérgenos[], ingredientes[], pasos[], publicadaEn, estado (borrador/publicada/oculta).
- **Ingrediente** (dentro de receta): nombre, cantidad, unidad.
- **Paso** (dentro de receta): orden, texto.
- **Etiqueta / Dieta**: id, nombre.
- **Alérgeno**: id, nombre (vocabulario cerrado).
- **Colección**: id, usuario, nombre, recetas[].
- **Guardado**: usuario, receta, colección, fecha.
- **Comentario**: id, receta, autor, texto, fecha, comentarioPadre (opcional).
- **Valoración**: usuario, receta, estrellas, fecha; única por usuario y receta.
- **Seguimiento**: seguidor, seguido, desde.
- **PlanSemanal**: usuario, semana (lunes inicial), entradas[].
- **EntradaPlanSemanal**: planSemanal, día, tipoComida, receta, racionesAjustadas.
- **Reporte**: id, tipo (receta|comentario), objetivo, motivo, estado, fecha.

### Reglas de integridad funcional

- Un **alérgeno marcado en receta** debe corresponder al vocabulario canónico.
- Un **ingrediente** debe poder convertirse a una unidad base (g/ml/ud) para sumar en la lista de compra; si no es convertible (p. ej. "una pizca"), se agrupa por texto.
- Una **receta oculta por moderación** deja de aparecer en feeds y búsquedas; sus comentarios se conservan anonimizados.
- **Borrar usuario** anonimiza autor de recetas/comentarios a «Cuenta eliminada» y bloquea el email.

---

## 12. Integraciones y dependencias funcionales

- **Servicio de correo transaccional** para verificación de email y recuperación de contraseña (requisito de disponibilidad ≥ 99%).
- **Almacenamiento de imágenes** (perfil y receta) con transformaciones para ajuste de tamaño y formato webp/jpg.
- **Open Graph** propio para previsualización al compartir por enlace.
- **Catálogo inicial de recetas**: al alta del servicio se publica un *seed* (≥ 30 recetas) para que el feed no esté vacío y existan datos para filtros y ejemplos.

---

## 13. Criterios de aceptación

- **CA-01** Una persona puede registrarse, verificar su correo y publicar su primera receta en menos de 10 minutos totales.
- **CA-02** Una búsqueda por texto «pollo» devuelve recetas cuyo título, descripción o ingredientes contienen «pollo», ordenadas por relevancia simple (coincidencia en título > descripción > ingredientes) y respeta el orden secundario seleccionado.
- **CA-03** Seleccionar un alérgeno en «Alérgenos a evitar» oculta todas las recetas que lo declaren, sin falsos negativos verificados manualmente sobre un set de 20 recetas.
- **CA-04** Asignar 5 recetas a lo largo de la semana y pulsar «Generar lista de compra» produce una lista sin ingredientes duplicados, con cantidades sumadas cuando las unidades coinciden.
- **CA-05** Seguir a una persona cambia el feed «Seguidos» para incluir sus próximas publicaciones en menos de 1 minuto.
- **CA-06** El 100% de las pantallas son navegables por teclado y superan contraste WCAG AA medido.
- **CA-07** La aplicación se renderiza de forma usable a 360px y hasta 1920px de ancho.

---

## 14. Riesgos, suposiciones y preguntas abiertas

### Suposiciones

- Se entrega como producto web responsive, sin app móvil.
- La audiencia habla español y el mercado principal es hispanohablante.
- No se modela monetización en el MVP.
- Las recomendaciones se limitan a reglas (recetas con etiquetas afines), no algoritmos de ML.

### Riesgos

- **R1 — Alérgenos**. Una mala gestión de filtros puede generar daño real (salud). Mitigación: vocabulario cerrado, filtrado por declaración explícita, mensaje claro en la UI y revisión manual antes del MVP.
- **R2 — Contenido reportado**. Riesgo de abuso si la moderación es manual. Mitigación: roles diferenciados, papelera, trazas de auditoría.
- **R3 — Rendimiento**. Imágenes pesadas degradan el feed. Mitigación: almacenamiento con transformaciones, dimensiones máximas obligatorias y carga diferida.
- **R4 — Privacidad**. Una persona podría arrepentirse de haber publicado. Mitigación: edición y borrado total con anonimización.
- **R5 — Spam de cuentas**. Mitigación: verificación de correo y límites de publicación por día en MVP.

### Preguntas abiertas

- ¿Confirmas que el alcance MVP propuesto (sin app móvil, sin monetización, sin SSO social) es lo que esperas?
- ¿Prefieres que las unidades de la lista de compra se unifiquen siempre (g/ml/ud) o solo cuando sea posible?
- ¿Cuál es el tiempo aceptable para que una receta publicada esté disponible en el feed de sus seguidores?
- ¿Deseas que el MVP incluya notificaciones por correo (más allá de verificación y recuperación)?

---

## 15. Fuentes

- Emergen Research — Recipe App Market Size, Share & Trends 2025–2035: https://www.emergenresearch.com/industry-report/recipe-app-market. Datos de tamaño de mercado y segmentación por tipo de app.
- Global Growth Insights — Recipe Apps Market Size, Share 2035: https://www.globalgrowthinsights.com/market-reports/recipe-apps-market-121500. Datos de engagement social (≈50% de interacciones) y hábitos saludables.
- The Coding Bus — Building a Recipe Sharing App with Social Features: https://thecodingbus.info/building-a-recipe-sharing-app-with-social-features-2/. Patrones comunes de UX y producto.
- Medium / Parui Pratap — De idea a lanzamiento, Yummunity (red social de recetas open source): https://medium.com/@Parui_Pratap/from-idea-to-launch-how-i-built-yummunity-a-social-platform-6456af9ee154. Referencia de feed con scroll infinito y mezcla de tipos de publicación.
- Simple Global Media — Recipe Sharing Platforms glosario: https://simplyglobalmedia.com/media-distribution-channels-glossary/recipe-sharing-platforms/. Definición y funciones comunes (calificaciones, guardado, seguir).
- Recipe API Blog — Los alérgenos son datos, no palabras clave: https://recipe-api.com/blog/allergen-data-recipe-apps. Base para el requisito RF-21 y la decisión de vocabulario cerrado.
- Beyond Ordinary — Arquitectura de recetas con alérgenos canónicos: http://beyond-ordinary.com/evidence/recipe-architecture. Referencia para el vocabulario FDA/UE modelado.
- Database Sample — Estructura y esquema de base de datos de app de recetas (34 tablas): https://databasesample.com/database/food-recipe-app-database. Referencia para el conjunto de entidades del MVP.
- RecipeShare — App existente de referencia (recetas, planes, listas): https://www.recipeshare.app/. Patrón de navegación entre descubrimiento, plan y lista.
- MealFlow Behance — Caso de estudio UI/UX de planificación semanal y lista de compra: https://www.behance.net/gallery/252502971/MealFlow-Meal-Planning-App-(-UIUX-Case-Study-)?l=7. Patrones visuales y de interacción.

> Este informe no incorpora código ni instrucciones técnicas de implementación; su contenido se basa en la solicitud del usuario, en el contexto de proyecto disponible y en las fuentes citadas.

## Fuentes
- [Recipe App Market Size, Share & Trends 2025–2035 (Emergen Research)](https://www.emergenresearch.com/industry-report/recipe-app-market) - Tamaño y segmentación del mercado de apps de recetas.
- [Recipe Apps Market Size, Share 2035 (Global Growth Insights)](https://www.globalgrowthinsights.com/market-reports/recipe-apps-market-121500) - Datos sobre engagement social y hábitos de uso saludable.
- [Building a Recipe Sharing App with Social Features (The Coding Bus)](https://thecodingbus.info/building-a-recipe-sharing-app-with-social-features-2/) - Patrones de UX y producto habituales en apps de recetas con componente social.
- [De idea a lanzamiento: Yummunity (Medium)](https://medium.com/@Parui_Pratap/from-idea-to-launch-how-i-built-yummunity-a-social-platform-6456af9ee154) - Referencia de feed de scroll infinito combinando tipos de publicación.
- [Recipe Sharing Platforms (Simple Global Media glosario)](https://simplyglobalmedia.com/media-distribution-channels-glossary/recipe-sharing-platforms/) - Funciones típicas: calificaciones, reseñas, guardado y seguir a otros usuarios.
- [Allergen Data Is Evidence, Not Keywords (Recipe API Blog)](https://recipe-api.com/blog/allergen-data-recipe-apps) - Argumento para modelar alérgenos como dato auditable y no como coincidencia de texto.
- [Recipe API — Dietary Flags (Blog)](https://recipe-api.com/blog/dietary-flags-recipe-apps) - Decisiones para tratar las dietas como dato de producto verificable.
- [Nutrition Recipe — Architecture (Beyond Ordinary)](http://beyond-ordinary.com/evidence/recipe-architecture) - Lista canónica de alérgenos mayores como base del vocabulario cerrado.
- [Food Recipe App Database Structure and Schema](https://databasesample.com/database/food-recipe-app-database) - Referencia para el conjunto de entidades del MVP.
- [RecipeShare](https://www.recipeshare.app/) - Patrón de navegación entre descubrimiento, planificación semanal y lista de compra.
- [MealFlow — Meal Planning App (Behance)](https://www.behance.net/gallery/252502971/MealFlow-Meal-Planning-App-(-UIUX-Case-Study-)?l=7) - Patrones UI/UX de planificación semanal y lista de compra.
