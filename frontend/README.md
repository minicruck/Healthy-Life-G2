# Frontend HU1 · Healthy Life

Interfaz de **Registrar actividad física**, desarrollada con React, TypeScript y Vite para el módulo E2 del equipo Scrum & Run. Responsabilidad frontend: Ahmed. El contrato compartido es [`../docs/hu1-api.md`](../docs/hu1-api.md); el servidor y la persistencia corresponden a Álvaro.

## Ejecutar en local

Se recomienda **Node.js 24 LTS**. La versión mínima declarada es Node.js **22.12**. Utiliza npm y el `package-lock.json` incluido para reproducir la instalación.

Desde la raíz del repositorio:

```bash
cd frontend
npm ci
```

La API utiliza `http://localhost:3001` por defecto. Para configurar otra dirección, copia el ejemplo **solo si no existe ya `.env.local`**:

```bash
cp -n .env.example .env.local
```

Contenido esperado de `.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:3001
```

Después:

```bash
npm run dev
```

Abre **http://localhost:5173**. El puerto es fijo: si está ocupado, Vite informa del conflicto en lugar de cambiar silenciosamente de origen. El backend debe estar arrancado por separado siguiendo sus propias instrucciones.

En un entorno con vista previa o reenvío de puertos puede ser necesario `npm run dev -- --host 0.0.0.0`. `VITE_API_BASE_URL` debe ser una URL accesible **desde el navegador**; su `localhost` se refiere al equipo que abre la página. Si el backend se expone con otra URL, configura esa dirección y acuerda con Álvaro el origen permitido por CORS. Una página HTTPS necesita una API accesible mediante HTTPS.

Las variables `VITE_*` son públicas y quedan incorporadas en el frontend: no contienen contraseñas ni tokens. Reinicia Vite tras cambiar `.env.local`; vuelve a compilar si utilizas `dist/`. No hay proxy Vite: el contrato asigna CORS al backend.

## Funcionalidad

El formulario de HU1 contiene:

| Campo                 | Comportamiento                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipo de actividad     | Obligatorio: Caminar (`walking`), Correr (`running`), Bicicleta (`cycling`), Gimnasio / entrenamiento (`gym`) u Otra (`other`).                               |
| Fecha de la actividad | Obligatoria, con el día local actual como valor inicial. Acepta fechas reales del calendario gregoriano en `YYYY-MM-DD`, incluidos años bisiestos.            |
| Observaciones         | Opcionales, con contador y un límite de 500 caracteres. No se corta automáticamente el texto que excede el límite: se muestra el error y se bloquea el envío. |

La fecha se conserva como texto sin convertirla a UTC. No se impone una prohibición de fechas futuras porque el contrato no la establece. Antes del envío se aplica `trim()` a las observaciones para coincidir con la normalización del backend: se eliminan los espacios de los extremos y, si el resultado está vacío, se omite `notes` del JSON. Se conservan los espacios y saltos de línea interiores. El texto del formulario y la validación del límite de 500 caracteres antes de normalizar permanecen intactos. El contador y la validación utilizan la longitud de las cadenas JavaScript: algunos símbolos, como determinados emojis, ocupan más de una unidad.

Los errores de campo aparecen al abandonar el campo o al intentar guardar. Un envío inválido enfoca el primer campo que requiere corrección. Durante la petición se deshabilitan los campos y el botón, se anuncia el estado de carga y una guarda adicional impide envíos simultáneos antes del siguiente renderizado de React.

El formulario conserva sus valores si falla la petición. Solo después de recibir y validar una respuesta `201 Created` muestra **«Actividad registrada correctamente.»** y prepara un nuevo formulario con la fecha local actual. No hay datos ficticios ni simulación de guardado en la aplicación.

## Comunicación con el backend

El cliente utiliza `fetch` para enviar `POST /api/activities` con `Content-Type: application/json`:

```json
{
  "activityType": "walking",
  "activityDate": "2026-10-09",
  "notes": "Caminata por el parque"
}
```

No se envían `userId`, duración ni intensidad. El backend asocia el usuario y genera `id` y `createdAt` después de guardar. Si no se enviaron observaciones, debe devolver `notes: null`.

Además del estado HTTP, el frontend comprueba en tiempo de ejecución la respuesta: identificador entero positivo, tipo y fecha coincidentes con la solicitud, observaciones exactamente iguales a las normalizadas y enviadas (o `null` si se omitieron) y fecha de creación ISO en UTC. No se normaliza la respuesta para ocultar discrepancias. TypeScript por sí solo no garantiza la forma del JSON recibido por la red.

Se distinguen los mensajes de validación de `400 / VALIDATION_ERROR`, los errores HTTP `404`, `413`, `500` y otros estados fallidos, los errores de red, el tiempo de espera agotado y las respuestas inesperadas. El mensaje español de un `400` con la estructura acordada puede mostrarse directamente; otros fallos reciben mensajes comprensibles sin exponer detalles internos.

La espera máxima es de **15 segundos**, incluida la lectura del cuerpo. El cliente permite cancelar la petición al desmontar la pantalla. **El POST nunca se reintenta automáticamente**: perder la respuesta o agotar el tiempo no demuestra que el servidor no haya guardado. El formulario no promete un registro «exactamente una vez»; esa garantía requeriría acordar un mecanismo de idempotencia con el backend.

## Organización

```text
frontend/
├── src/
│   ├── main.tsx                         # Montaje de React y fuentes locales
│   ├── pages/RegisterActivityPage.tsx   # Composición de la pantalla HU1
│   ├── components/
│   │   ├── ActivityForm.tsx             # Campos, botón y mensajes del formulario
│   │   ├── FieldError.tsx               # Mensaje de error vinculado a un campo
│   │   └── MovementIllustration.tsx     # Ilustración SVG decorativa original
│   ├── hooks/useActivityForm.ts         # Estado, validación, envío y cancelación
│   ├── types/activity.ts               # Tipos y catálogo de actividades
│   ├── lib/activityValidation.ts       # Calendario, validación y JSON de envío
│   ├── services/activities.ts          # Cliente HTTP y validación de respuesta
│   ├── styles.css                      # Diseño, estados y adaptación responsive
│   ├── test/setup.ts                   # Preparación de pruebas de componentes
│   └── **/*.test.ts(x)                 # Pruebas junto al código que comprueban
├── e2e/activity.spec.ts                # Pruebas de navegador con API interceptada
├── public/favicon.svg
├── docs/defensa-hu1.md                 # Explicación del código para clase
├── .env.example
├── vite.config.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json / package-lock.json
```

Las dependencias de ejecución son React, React DOM y los paquetes de fuentes locales de Fontsource. El desarrollo utiliza TypeScript, Vite y su plugin de React; las pruebas utilizan Vitest, jsdom, Testing Library, Playwright y axe. Prettier mantiene el formato del código. No se utiliza una biblioteca de componentes, un framework CSS ni un gestor global de estado.

## Diseño y accesibilidad

La composición combina una introducción editorial con un formulario de registro numerado y una ilustración de pista dibujada en SVG. El color destaca la acción principal y los estados, con bordes contenidos y sin una sucesión de tarjetas de dashboard.

La guía de Behance indicada como referencia no pudo consultarse en este entorno: devolvió HTTP `403`. Por tanto, los siguientes valores son **decisiones de diseño propuestas**, no colores oficiales de la URJC:

| Uso                       | Propuesta       |
| ------------------------- | --------------- |
| Acento y acción principal | Rojo `#a71930`  |
| Texto principal           | Tinta `#242722` |
| Fondo                     | Papel `#f5f3ed` |

Se emplea **DM Sans** para interfaz y **Instrument Serif** para el título, empaquetadas localmente mediante Fontsource. Ambas utilizan licencia SIL Open Font License, incluida en sus paquetes. El navegador no necesita solicitar tipografías a un servicio externo. La marca tipográfica de Healthy Life es una propuesta propia; no reproduce un logotipo oficial de la universidad.

El CSS define estados normal, hover, foco, pulsado, deshabilitado y guardando para el botón. Las transiciones de campos y mensajes duran aproximadamente 160–260 ms. El indicador de envío gira solo mientras existe una petición. `prefers-reduced-motion` elimina animaciones y transiciones.

El diseño pasa a una columna en tablet y móvil. Incluye etiquetas asociadas, campos obligatorios identificados, foco visible, enlace para saltar al formulario, errores mediante `aria-describedby` y `aria-invalid`, anuncios de error con `role="alert"` y confirmaciones con una región de estado. La ilustración decorativa se oculta a lectores de pantalla.

## Pruebas y compilación

Ejecuta desde `frontend/`:

```bash
npm test
npm run typecheck
npm run build
npm run format:check
```

`build` vuelve a comprobar TypeScript y genera `dist/`. Para revisar esa compilación: `npm run preview`. Para desarrollar ejecutando las pruebas continuamente: `npm run test:watch`. `npm run format:check` comprueba el formato; `npm run format` lo aplica a los archivos del frontend.

Pruebas de navegador:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright arranca Vite automáticamente y ejecuta los proyectos `desktop` y `mobile`. Si este entorno en la nube ya dispone de Chromium del sistema, puede utilizarse sin descargar otro navegador:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

La variable es opcional y solo debe apuntar a un ejecutable existente. Las capturas generadas se guardan en `test-results/`, excluido de Git; en caso de fallo también se conserva una traza.

| Nivel        | Cobertura                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validación   | Opciones, campos obligatorios, fechas reales e inexistentes, bisiestos, fecha local, límite 500/501, notas opcionales y JSON.                                               |
| Cliente HTTP | URL y cuerpo enviados, ausencia de campos ajenos al contrato, `201` válido, `400`, `404`, `413`, `500`, red, JSON o estructura inesperados, cancelación y tiempo de espera. |
| Componentes  | Renderizado, interacción, mensajes vinculados, conservación y limpieza de valores, estado de carga, bloqueo de duplicados y confirmación solo tras éxito real.              |
| Navegador    | Escritorio y móvil, teclado, foco, hover, envío, errores, movimiento reducido, desbordamientos en varios anchos y auditorías automáticas axe.                               |

Los mocks de `fetch` y las respuestas interceptadas por Playwright se limitan a las pruebas. Las pruebas de navegador recorren el frontend completo, pero **no validan el backend real, CORS ni SQLite**. Una auditoría automática de accesibilidad tampoco sustituye una revisión humana con lector de pantalla.

### Resultados de la implementación previa de HU1

| Comprobación ejecutada                                                   | Resultado                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `npm test`                                                               | 118 pruebas superadas: 25 de interfaz y 93 de validación/cliente HTTP. |
| `npm run typecheck`                                                      | Sin errores de TypeScript.                                             |
| `npm run build`                                                          | Compilación de producción completada.                                  |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 14 pruebas superadas entre los proyectos de escritorio y móvil.        |

Las pruebas de navegador incluyen auditorías axe en los estados inicial, validación, éxito y error del servidor, además de foco por teclado, hover, movimiento reducido y comprobaciones de desbordamiento a varios anchos. Se ejecutaron en Chromium; no se ha validado aquí Safari ni Firefox.

## Capturas

Las imágenes conservadas en [`docs/screenshots/`](docs/screenshots/) permiten revisar la presentación sin arrancar el proyecto:

| Vista                                             | Captura                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Escritorio, formulario inicial                    | [desktop.png](docs/screenshots/desktop.png)                                         |
| Móvil, formulario inicial                         | [mobile.png](docs/screenshots/mobile.png)                                           |
| Errores de validación en móvil                    | [validation-mobile.png](docs/screenshots/validation-mobile.png)                     |
| Confirmación tras un `201` simulado por la prueba | [success-desktop.png](docs/screenshots/success-desktop.png)                         |
| Error de red simulado por la prueba               | [network-error-desktop.png](docs/screenshots/network-error-desktop.png)             |
| Petición real sin backend disponible, sin mocks   | [backend-unavailable-desktop.png](docs/screenshots/backend-unavailable-desktop.png) |

La captura de éxito procede exclusivamente de una prueba con respuesta HTTP interceptada. Ilustra el estado visual; **no acredita un registro persistido por el backend real**. La captura con el backend no disponible documenta el error de conexión de la aplicación real, sin simular una respuesta satisfactoria.

## Integración pendiente

Con el backend de Álvaro disponible, comprobar conjuntamente el origen CORS, el `POST` y su respuesta `201`, errores reales y la persistencia en SQLite. Los endpoints auxiliares `GET /api/health` y `GET /api/activities` pueden ayudar a esa comprobación; el frontend no los utiliza ni añade un historial.

El backend mantiene la asociación al usuario de prueba `DEMO_USER_ID` mientras no exista la integración con E1. Este frontend no implementa autenticación, estadísticas, objetivos, duración ni intensidad. Tampoco contiene servidor, consultas SQL ni configuración Docker.

Para preparar la exposición, consulta [la explicación para defender HU1 en clase](docs/defensa-hu1.md).

## HU2 — Registrar horas de sueño (SCRUM-2)

La misma aplicación permite alternar entre actividad física y sueño sin perder los borradores. El formulario de HU2 envía tres campos obligatorios:

| Campo            | Reglas                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Fecha del sueño  | Fecha real `YYYY-MM-DD`, del año `0001` en adelante y no posterior a hoy en **Europe/Madrid**. |
| Horas dormidas   | Número finito mayor que `0` y menor o igual que `24`; admite decimales.                        |
| Tipo de descanso | `night` (Sueño nocturno), `nap` (Siesta) u `other` (Otro). Se debe elegir una opción.          |

El contrato completo está en [`docs/hu2-api.md`](../docs/hu2-api.md). `POST /api/sleep` registra y `GET /api/sleep` consulta los datos del mismo usuario configurado en el backend. No se envía `userId`.

Se permiten varios descansos de la misma fecha, incluidas varias siestas. Cada fila conserva su identificador, fecha de creación y horas. Los datos históricos sin clasificación llegan como `sleepType: null` y se muestran como **Sin clasificar**, sin atribuirles un tipo ficticio. El POST permite omitir el tipo solo para conservar compatibilidad con clientes antiguos; el formulario actualizado siempre exige seleccionarlo.

### Editar un descanso

Cada entrada del desglose diario y de **Ver todos los registros** tiene un botón **Editar**. Abre un diálogo con la fecha, horas y tipo actuales. Se puede cancelar sin enviar peticiones, o guardar los tres campos mediante `PATCH /api/sleep/:id`.

La edición solo se confirma con HTTP `200` y una respuesta válida cuyos datos coincidan con lo enviado y cuyos `id` y `createdAt` sigan siendo los originales. Un error mantiene el borrador. Durante el envío se bloquean los controles y los envíos simultáneos. No se repiten automáticamente POST ni PATCH.

El diálogo permite navegación por teclado, contiene el foco, admite Escape cuando no se está guardando y devuelve el foco al cerrar. Después de confirmar una edición, el foco pasa al encabezado de estadísticas, que sigue presente aunque el registro salga del filtro por cambiar de fecha.

### Fechas y calendario

El navegador y la API calculan hoy en **Europe/Madrid**, independientemente de la zona horaria del ordenador o de Docker. El selector incluye `max` y la validación TypeScript comprueba también las fechas futuras. El servidor vuelve a validarlas y es la autoridad final.

El límite se actualiza a medianoche de Madrid y al recuperar el foco o la visibilidad de la pestaña; contempla días de 23 y 25 horas. Las fechas del usuario siguen siendo cadenas de calendario, sin desplazarlas a otro día mediante UTC.

Los registros futuros guardados por versiones anteriores se conservan. Aparecen identificados en **Todo el historial**, pero no en los períodos recientes. Para editarlos debe corregirse su fecha antes de guardar.

### Estadísticas y dos perspectivas del descanso

Se conservan las cinco métricas anteriores: media por registro, total, cantidad de registros, máximo individual y mínimo individual. Se añade la **media diaria de sueño**, junto con el número de días con registros.

- **Media por registro:** total de horas dividido entre número de registros.
- **Media diaria:** total de horas dividido entre número de fechas distintas con registros.
- **Total diario:** suma de todos los registros con el mismo `sleepDate`.

`aggregateSleepDays` agrupa sin modificar ni fusionar las filas. Conserva los registros individuales y los subtotales de Sueño nocturno, Siesta, Otro y Sin clasificar. La suma decimal evita arrastrar artefactos como `0.1 + 0.2`; la presentación de las métricas utiliza como máximo dos decimales. Los registros individuales siguen mostrando la precisión recibida. No se inventan datos para fechas sin registros ni se consideran días de cero horas.

Ejemplo: 7 h nocturnas, 1,5 h de siesta y 1 h de otro descanso el 12/10, más 8 h el 11/10: total **17,5 h**, **4 registros**, **2 días**, media por registro **4,375 h** (presentada como 4,38) y media diaria **8,75 h**. Si la siesta pasa a 2 h, el total diario del 12/10 es **10 h**, el general **18 h** y la media diaria **9 h**, manteniendo 4 registros.

La gráfica original conserva un punto por registro, ordenado por fecha e identificador; los registros del mismo día no se sustituyen por un punto agregado. Debajo, **Tu descanso día a día** añade barras apiladas con una barra por fecha y un segmento por tipo. La categoría Sin clasificar mantiene visibles los datos históricos. Los tooltips y la navegación por teclado complementan el desglose textual accesible de cada día, desde el que también se puede editar.

Los grupos diarios muestran fecha, total, cantidad y detalle. El más reciente se abre inicialmente. Si un día suma más de 24 horas, se indica para revisión, sin borrar datos ni añadir una restricción diaria nueva.

### Períodos, consulta y actualización

Los mismos filtros controlan las seis métricas, ambas gráficas, la tabla y el desglose diario:

| Período           | Registros incluidos                                                 |
| ----------------- | ------------------------------------------------------------------- |
| Últimos 7 días    | Hoy en Madrid y los seis días anteriores, ambos extremos incluidos. |
| Últimos 30 días   | Hoy en Madrid y los 29 días anteriores.                             |
| Todo el historial | Todos los registros, incluidas fechas futuras históricas.           |

`getSleepRecords()` reutiliza `VITE_API_BASE_URL`. Exige HTTP `200`, un array y registros válidos con identificadores únicos, fechas reales, horas dentro del rango, tipos conocidos o `null` y `createdAt` UTC válido. Un JSON incorrecto no se convierte en una lista vacía. La aplicación no utiliza datos simulados; los mocks están exclusivamente en las pruebas.

El tiempo máximo de las solicitudes es de 15 segundos, incluida la lectura del cuerpo. Las consultas obsoletas se cancelan y sus respuestas se descartan. Cambiar de filtro no repite el GET. Los estados de carga, vacío, datos fuera del período y error tienen mensajes diferenciados.

Tras confirmar POST o PATCH, se consulta de nuevo el servidor. Esto actualiza automáticamente todas las vistas sin duplicar registros. Un fallo de esa consulta muestra un error independiente con **Reintentar consulta** y mantiene el mensaje de éxito del guardado. Reintentar ejecuta únicamente GET; no repite la escritura.

### Organización de HU2

| Archivos                                                                | Responsabilidad                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `types/sleep.ts`, `lib/sleepValidation.ts`                              | Tipos del contrato y validaciones del formulario.                           |
| `lib/sleepCalendar.ts`, `hooks/useSleepToday.ts`                        | Calendario de Madrid y actualización del límite de fecha.                   |
| `services/sleep.ts`                                                     | POST, GET y PATCH, validación estricta, errores y cancelación.              |
| `hooks/useSleepForm.ts`, `components/SleepForm.tsx`                     | Registro de descansos.                                                      |
| `hooks/useSleepEdit.ts`, `components/SleepEditDialog.tsx` y su CSS      | Edición accesible sin cambiar la identidad del registro.                    |
| `hooks/useSleepRecords.ts`, `components/SleepDashboard.tsx`             | Consulta, filtros, actualización y coordinación.                            |
| `lib/sleepStatistics.ts`, `components/SleepStatsCards.tsx`              | Métricas por registro y presentación de las seis cifras.                    |
| `lib/sleepDailyStatistics.ts`                                           | Agregación y media diaria, independientes de React.                         |
| `components/SleepEvolutionChart.tsx`, `SleepRecordsTable.tsx` y sus CSS | Gráfica individual y alternativa tabular con tipos y edición.               |
| `components/SleepDailySection.tsx`, `SleepDailyChart.tsx` y sus CSS     | Desglose diario y barras apiladas, con alternativa textual.                 |
| `pages/RegisterActivityPage.tsx`                                        | Integración en la aplicación existente; HU1 sigue siendo la opción inicial. |

Todas las rutas de esta tabla parten de `src/`. Se mantiene **Recharts 3.10.1**; esta ampliación no añade dependencias. Las gráficas se cargan bajo demanda y un fallo de carga deja disponibles los datos textuales y los formularios. Se mantiene la identidad crema/rojo, DM Sans e Instrument Serif, el diseño responsive y `prefers-reduced-motion`.

### Pruebas

```bash
# Desde backend/
npm test
npm run typecheck

# Desde frontend/
npm test
npm run typecheck
npm run build
npm run format:check
npm run test:e2e
```

Se mantienen las pruebas HU1 y las del dashboard anterior, adaptando únicamente las expectativas HU2 que cambian en este contrato. Las pruebas nuevas cubren tipos, PATCH, migración real de SQLite, aislamiento de usuarios, fechas de Madrid y cambios de horario, cálculos diarios, edición, errores, concurrencia y actualización de vistas. Playwright comprueba ambos formularios, teclado, accesibilidad y los anchos 320, 375, 768, 1024 y 1440 px.

Las pruebas automatizadas del navegador utilizan respuestas controladas. La prueba adicional con Docker utiliza Express y SQLite reales y comprueba la conservación de los datos tras reiniciar; sus resultados concretos se registran en la entrega de esta ampliación.

### Resultados de esta ampliación

Comprobado con Node.js 24 y Chromium: **43/43 pruebas backend**, **618/618 pruebas frontend** y **70/70 pruebas Playwright**, incluidas las originales de HU1. TypeScript de ambos proyectos, compilación de producción y formato correctos.

La prueba adicional contra Docker real conservó los registros anteriores sin clasificar, creó cuatro descansos, editó la siesta de 1,5 a 2 horas sin aumentar el número de filas y actualizó el total diario de 9,5 a 10 horas. También confirmó HU1, el rechazo de fechas futuras y la igualdad de los registros de sueño y actividades tras reiniciar ambos contenedores. No se borró el volumen.

La compilación Docker en Codex usa una CA pública del entorno y un contexto temporal con permisos normales de Git para adaptarse al proxy y al sistema de archivos de esta nube. Dockerfiles, Compose y Nginx permanecen sin cambios; esta adaptación local no es necesaria como paso adicional del proyecto en Windows.

### Revisar y publicar posteriormente

Esta ampliación parte de `main` del equipo con la PR #4 ya fusionada. La nueva rama es `feature/hu2-sleep-improvements`; no se reutiliza la PR #4. Para revisar los cambios localmente:

```bash
git status
git diff --stat upstream/main
git diff upstream/main -- backend/src frontend/src docs/hu2-api.md
```

Solo cuando el autor decida publicar, y comprobando que `origin` apunta a su fork:

```bash
git remote get-url origin
git add backend frontend docs/hu2-api.md
git commit -m "feat: amplía HU2 con tipos de descanso, edición y estadísticas diarias"
git push -u origin feature/hu2-sleep-improvements
```

Después debe abrirse una **nueva PR** hacia `minicruck/Healthy-Life-G2:main`, con origen `ahmed234fgtv/Healthy-Life-G2:feature/hu2-sleep-improvements`. Estos comandos documentan pasos posteriores; no publican nada por sí solos.

### Actualizar en Windows con Docker

Una vez publicada la nueva rama, desde PowerShell en la copia del fork:

```powershell
git fetch origin
git switch --track origin/feature/hu2-sleep-improvements
# Si la rama ya existe: git switch feature/hu2-sleep-improvements
git pull --ff-only origin feature/hu2-sleep-improvements
docker compose up --build -d
docker compose ps
```

No se necesita instalar Recharts aparte ni ejecutar una migración manual. Al arrancar el backend se añade `sleep_type` si falta; las filas anteriores quedan sin clasificar. La reconstrucción conserva el volumen existente. No se debe eliminar ese volumen ni ejecutar `docker compose down -v`.

Abra `http://localhost:5173`, entre en **Horas de sueño**, registre una siesta y edítela desde el detalle diario. Compruebe que se actualizan las cifras. Puede ejecutar `docker compose restart` y volver a consultar para verificar la persistencia sin eliminar datos.
