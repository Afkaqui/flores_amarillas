# Flores Amarillas — plan de la siguiente versión

Estado: implementación en revisión local. El 14 de septiembre de 2026 el usuario indicó expresamente NO desplegar hasta haber probado en local. No actualizar producción sin su indicación posterior. La previsualización aislada del VPS quedó detenida; la web pública conserva la primera versión.

Disponible para revisar en local: creador de tres pasos, dibujos adjuntos a una única carta, propuestas editables de GLM-5.3-Flash vía Go, fotos, voz y respuestas visibles en esa misma carta. La descripción siguiente conserva los objetivos y criterios del plan; la validación del usuario sigue pendiente.
Base: commit `06c883e`, primera mejora del jardín, las cartas y los regalos personalizados.

## 1. Objetivo y dirección

Convertir la web en un pequeño jardín de una historia compartida: preparar un ramo, escribir una carta con ayuda opcional y entregarlo mediante una experiencia cuidada en móvil y escritorio.

El agente integrado usará GLM-5.3-Flash a través de la suscripción OpenCode Go. Go es el proveedor del agente que atiende dentro de la aplicación, no un sustituto de ese agente por una herramienta de desarrollo.

La identidad visual conservará cielo azul, vegetación viva y flores amarillas. El efecto romántico vendrá de la composición, los materiales, las palabras y las interacciones. El amarillo se concentrará en las flores y algunos acentos. No habrá una capa amarilla global ni desenfoque de pantalla completa.

## 2. Base existente que se amplía

- Jardín Three.js, animaciones y controles de música, cámara y ambiente.
- Carta, remitente, destinatario, tres recuerdos, papel, lazo y cantidad de flores.
- Sobre del destinatario, enlace compartible, imagen social y postal PNG.
- Borradores locales y compatibilidad con regalos antiguos.
- Backend Express y PostgreSQL, esquema compartido de validación.
- Corrección del crecimiento y de la transición al editor para evitar parpadeos.

Las siguientes fases deben mantener esos recorridos y sus datos compatibles.

## 3. Referencias y traducción al producto

| Referencia revisada                                                                              | Idea que se adapta                                                     |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [DigiBouquet](https://digibouquet.net/create-bouquet)                                            | Selección visual y progresiva de los componentes del regalo.           |
| [Anna's Secret Garden](https://annasgarden.vercel.app/)                                          | Un dibujo propio como detalle personal dentro de la carta.             |
| [Rifle Paper Co. en Paperless Post](https://www.paperlesspost.com/es/cards/group/rifle-paper-co) | Papelería botánica, ilustraciones, marcos y variedad de composiciones. |

Se crearán diseños y recursos propios; las referencias orientan la experiencia y la composición.

### Referencia principal elegida: Anna's Secret Garden

El usuario eligió expresamente este proyecto. En la revisión de su página y galería se observaron una isla verde con contorno orgánico, perspectiva elevada, sombras simples, tipografía dibujada, una zona de dibujo con cinco colores y una galería de flores. Estas observaciones describen la interfaz; no implican haber inspeccionado su implementación.

**Dirección revisada tras la prueba local.** El jardín ilustrado como miniatura se retiró del creador: no tenía una acción ni un destino claro. De Anna se conserva el gesto personal de dibujar, aplicado a «Dibújale algo» dentro de la carta.

La persona puede dibujar libremente un corazón, una flor o un detalle propio, añadirle una frase y adjuntarlo a la carta. Cinco colores, dos grosores, deshacer, limpiar y una flor guía opcional. Los dibujos y sus dedicatorias aparecen al abrir la carta, junto a las fotos, la voz y las respuestas; no hay una segunda pantalla de detalles. Los datos existentes siguen siendo compatibles. El jardín 3D original sigue siendo el escenario de las flores.

La carta reúne palabras y dibujos en una columna, y tarjetas de razones, fotos, voz y respuesta opcional en otra. En móvil se apilan. Fotos con selector visual, arrastrar y soltar, miniaturas y eliminación; voz con espacio y control propio. La respuesta se presenta como otro detalle personal junto a la carta. El autor no puede responder desde su sesión; quien recibe firma con un apodo y puede responder una vez por sesión. La carta consulta respuestas mientras está visible, y el inicio permite volver al último regalo. No equivale a identificar personas entre dispositivos.

**Papel del agente.** A partir de la conversación ofrece tres cartas y estilos diferenciados en tarjetas seleccionables, y dos o tres acciones contextuales para afinarlos. La persona elige y aplica; puede deshacer. No genera ni analiza los dibujos.

**Validación de esta revisión.** Dibujos conservados y visibles al abrir la carta; controles de adjuntos claros; tres opciones reales del proveedor, selección, aplicación y deshacer; esquemas limitados y compatibilidad de datos. Sólo entorno local hasta que el usuario pruebe y autorice despliegue.

## 4. Sistema visual

- Paleta inicial propuesta: verde profundo `#244B3C`, verde hoja `#6A9856`, azul cielo `#BFE3F5`, blanco papel `#FFFCF7`, rosa `#C98091`, amarillo floral `#F2C94C`. Comprobar contraste antes de cerrar los tokens; los tonos claros no serán texto de lectura.
- Tipografía: una serif expresiva en títulos, sans legible en controles y texto, escritura manual limitada a firmas. Lectura móvil desde 16 px.
- Papel con textura muy ligera, pliegues y bordes ilustrados; sombra localizada para separar superficies.
- Botones primarios verdes; secundarios discretos. Un solo llamado principal por paso.
- Estados coherentes de foco, selección, carga, éxito, error y desactivado.
- Ilustración y 3D con igual lenguaje de color, lazo y envoltorio para que la vista previa y el regalo coincidan.
- Dos ambientes iniciales: día luminoso y noche azul con luces pequeñas. La noche mantendrá texto y controles legibles.

## 5. Recorrido de creación

### Entrada

Jardín protagonista, frase breve y botón «Preparar un regalo». Acceso secundario al jardín libre. Si existe un borrador, ofrecer continuarlo con una vista previa pequeña.

### Paso 1: Para quién

Destinatario, remitente, ocasión y tono opcional. Las preguntas sensibles o los recuerdos no serán obligatorios. Acceso «Ayúdame a prepararlo» para iniciar al agente con el contexto ya escrito.

### Paso 2: Tu ramo

Tres composiciones iniciales: sencillo, silvestre y abundante. Ajustes de cantidad dentro de los límites existentes, papel, lazo y ambiente. Añadir dos o tres especies con siluetas distinguibles y colores que acompañen las flores amarillas.

Vista previa grande en escritorio. En móvil, vista previa compacta arriba y controles al alcance del pulgar. Cambiar un color debe conservar cámara, semilla y distribución; sólo los cambios de composición modificarán la disposición.

### Paso 3: Tu carta

Editor legible, sugerencias opcionales y recuerdos desplegables. Acciones «Más breve», «Más natural», «Más romántica» y edición libre. Guardado automático con estado visible y posibilidad de deshacer una propuesta del agente.

### Revisar y compartir

Previsualización como destinatario, volver a editar, copiar enlace, compartir mediante el dispositivo y descargar postal. Mostrar errores de guardado con una salida útil y conservar el borrador.

## 6. Experiencia de quien recibe

1. Sobre con nombre y firma, listo para abrir.
2. Gesto de abrir o desatar el lazo; alternativa accesible mediante botón.
3. Aparición suave del ramo y carta inmediatamente accesible.
4. Recuerdos asociados a flores con una lista equivalente para teclado y lectores de pantalla.
5. Leer otra vez, guardar la postal y crear un regalo propio.

Música sólo tras una acción explícita. Lectura completa disponible al instante, con opción de saltar la presentación. Movimiento reducido elimina desplazamientos innecesarios. El destinatario ve el contenido elegido por el autor, nunca la conversación con el agente.

## 7. Agente integrado mediante OpenCode Go

### Experiencia

Nombre provisional visible: «Tu cómplice». Entrada: «Cuéntame para quién es y qué te gustaría decirle». Panel lateral en escritorio y panel móvil que pueda cerrarse sin perder el trabajo. Su estado mostrará qué hace: redactar una propuesta, revisar el tono o preparar una combinación.

Ejemplo: «Es para Ana, le gustan las cosas sencillas. Quiero agradecerle que me acompañara esta semana». El agente devuelve tres opciones de carta y estilo de ramo basadas en ese contexto, con acciones para afinarlas. «Menos cursi» produce una revisión que la persona puede aplicar o descartar.

### Capacidades iniciales

- Redactar o revisar una carta en español usando sólo los hechos aportados.
- Ajustar longitud y tono, conservar nombres y expresiones personales.
- Proponer combinaciones del catálogo existente.
- Sugerir cómo convertir un recuerdo aportado en una dedicatoria breve.
- Mantener el contexto de la sesión y explicar brevemente una propuesta.

La respuesta sobre una propuesta no inventará aniversarios, acontecimientos o preferencias. Tampoco prometerá enviar, publicar o programar acciones que el producto no haya realizado.

### Arquitectura propuesta

Navegador → API propia Express → servicio del agente → OpenCode Go → `glm-5.3-flash`.

La documentación revisada publica `https://opencode.ai/zen/go/v1/chat/completions` para ese modelo. La clave se configurará sólo en el servidor. Referencia: [OpenCode Go](https://opencode.ai/docs/go/).

Go orienta su servicio a agentes de programación. Antes de habilitar este asistente para visitantes, confirmar que este uso encaja en el servicio y verificar acceso real del modelo con la cuenta. Se conserva Go como proveedor propuesto; no se sustituirá silenciosamente por otro.

El agente tendrá herramientas de dominio acotadas: consultar estilos, proponer una carta y proponer cambios del regalo. No necesita shell, acceso al repositorio ni ejecución de código generado por visitantes. Una propuesta estará ligada a la versión del borrador: si la persona lo modifica mientras espera, nunca sobrescribirá el texto nuevo automáticamente.

El servidor validará la estructura, longitudes y opciones de cada propuesta. El navegador podrá mostrar texto conforme llega, pero sólo aplicará cambios visuales completos y validados, después de «Aplicar». Incluir deshacer, cancelar y descartar. Si falla la IA, el editor manual permanece operativo.

### Sesiones y consumo

- Sesión por creador, aislada de otros visitantes y del enlace del regalo.
- Contexto acotado al borrador actual y mensajes necesarios; caducidad propuesta de 24 horas para conversaciones temporales.
- Una petición activa por sesión, cancelación y límite de salida.
- Cuotas por sesión, límites globales de concurrencia y presupuesto configurable.
- Reintentos limitados; errores del proveedor explicados sin exponer detalles internos.
- Métricas de latencia, errores y consumo sin registrar cartas ni recuerdos en logs ordinarios.
- No hacer llamadas permanentes en segundo plano: «vivo» significa que conserva contexto y responde a las acciones del usuario.

## 8. Detalles personales de una segunda entrega

- Respuesta del destinatario con una flor dibujada, ampliando el dibujo del autor que ya se incluye en fase 2.
- Hasta tres fotos opcionales vinculadas a recuerdos; compresión, límites de tamaño, formatos permitidos y eliminación de metadatos.
- Nota de voz opcional de hasta 30 segundos, escuchable antes de guardar y reemplazable.
- Almacenamiento de archivos con referencias desde PostgreSQL; nunca incorporar fotos o audio en el hash de una URL.
- Gestión del regalo mediante un token de edición independiente del enlace de lectura, permitiendo retirar archivos o eliminar el regalo.
- Cuando el backend no pueda guardar archivos, mantener texto y ramo, explicar el límite y no informar de un guardado completo que no ocurrió.

Estas funciones requieren completar almacenamiento, límites y eliminación antes de habilitar subidas.

## 9. Organización del código

- Extraer de `js/main.js` el estado del creador, navegación de pasos y coordinación del asistente, manteniendo un único borrador como fuente de datos.
- Mantener `js/garden.js` centrado en escena y presentación; desacoplar peticiones de IA del bucle de animación.
- Ampliar `shared/gift.js` con versión de esquema y validación compatible para especies, composición y referencias a recuerdos enriquecidos.
- Extender los generadores de vista previa, postal y OpenGraph para representar el mismo regalo.
- Añadir servicios y rutas específicas del asistente al backend, con configuración del proveedor fuera del frontend.
- Migraciones idempotentes para nuevos datos. Separar conversaciones temporales del contenido final del regalo.
- Resolver exportación de versiones antiguas con valores por defecto; conservar enlaces cortos y hashes anteriores.

## 10. Rendimiento y estabilidad

- Un solo responsable del crecimiento de las flores; no reiniciar animaciones al escribir, recibir tokens o cambiar de paso.
- Cambios de papel y lazo actualizan materiales; conservar objetos cuando sea posible y liberar recursos cuando se sustituyan.
- Cámara estable durante la creación y lectura, incluso al abrir el teclado móvil.
- Calidad adaptable en sombras, partículas y densidad de hierba.
- Recuperación de pérdida de WebGL con una ilustración legible y el editor funcional.
- Metas iniciales: interacción fluida y al menos 30 FPS en el dispositivo móvil de referencia; objetivos que se medirán, no resultados ya obtenidos.

### Despliegue y almacenamiento en vps-kaqui

El usuario confirma que la primera versión ya vive en `vps-kaqui` y que dispone de espacio. La siguiente versión ampliará ese despliegue. Todavía no se han comprobado en remoto RAM, CPU, disco disponible, versiones o carga; no se presupone capacidad de GPU ni se desplegará durante la elaboración del plan.

**Responsabilidades.** El navegador renderiza el jardín interactivo, el ramo, los trazos del editor y las transiciones. El VPS sirve la aplicación, persiste los regalos y jardines, gestiona sesiones del agente y peticiones a Go, almacena archivos y genera imágenes de postal y vista previa. GLM se ejecuta en el proveedor Go: no requiere instalar los pesos del modelo ni una GPU en el VPS.

**Servicios previstos.** Conservar el proxy HTTPS, contenedor de aplicación y PostgreSQL existentes cuando se verifique su configuración real. Incorporar un volumen persistente propio de la aplicación para dibujos derivados, fotos y audios, fuera del sistema de archivos efímero del contenedor. La base guardará referencias a archivos y los trazos del dibujo. No duplicar una base o un proxy ya operativos sin necesidad.

La primera entrega usará un servicio de aplicación con concurrencia limitada para la IA. Si se añaden tareas costosas como exportación de vídeo, ejecutarlas mediante un trabajador separado y trabajos persistidos, con tope de concurrencia. Renderizar un vídeo en el servidor no es necesario para mover las flores en la web. La exportación de vídeo queda para después de medir el coste real de CPU y memoria; se mantiene PNG como exportación inicial.

**Medios.** Empezar con disco persistente del VPS y una interfaz de almacenamiento que permita migrar a almacenamiento de objetos si el uso crece. Nombres opacos, verificación de formato, límites por archivo y regalo, generación de miniaturas y limpieza de archivos huérfanos. Los enlaces de lectura no conceden modificación; token de gestión independiente para borrar. Copias coordinadas de base y medios, con una copia fuera del VPS y prueba de restauración.

**Operación.** Límites de subida en proxy y aplicación, cuotas de IA, métricas de uso del disco, latencia y errores; registros sin conversaciones ni claves. La caducidad de una conversación no elimina automáticamente un regalo compartido. Definir retención de regalos y archivos explícitamente antes de lanzar medios personales.

**Ruta de entrega.** Inventario de sólo lectura mediante el perfil autorizado `vps-kaqui`; confirmar ruta del proyecto y servicios propios. Crear una previsualización aislada con su base y medios de prueba. Ejecutar migraciones compatibles, verificar regalos antiguos, probar Go con una entrada sintética y medir respuestas. Construir la imagen, respaldar datos, publicar únicamente los servicios del proyecto y verificar la versión pública mediante BrowserOS neo. Mantener imagen anterior y esquema compatible para revertir la aplicación sin restauraciones destructivas automáticas.

**Ajuste detectado en el despliegue local.** `deploy/desplegar.sh` empaqueta `index.html`, `css`, `js`, `server` y otros archivos, pero omite la nueva carpeta `shared/` que el Dockerfile ya necesita. Corregirlo y comprobar el contenido del paquete antes de cualquier despliegue de la primera mejora o de V2. Revisar también la comprobación que crea un regalo: usar un identificador único de prueba y eliminar sólo ese registro, evitando una limpieza por nombre genérico. Estas observaciones corresponden al código local; no afirman que el servidor haya fallado.

El espacio disponible facilita guardar recursos, pero no reemplaza la medición de CPU, memoria, concurrencia ni los límites de la suscripción Go. Se medirán con una carga representativa antes de fijar capacidad de visitantes simultáneos.

## 11. Fases y criterios de entrega

| Fase                      | Entrega                                                                                             | Se considera terminada cuando                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Preparación            | Contrato del agente, tokens visuales y recorrido dibujado; comprobación de Go                       | Modelo, configuración y condiciones de uso quedan resueltos; existe una propuesta concreta de pantallas.                                       |
| 1. Diseño y creador       | Nueva portada y creador de tres pasos                                                               | Se completa un regalo con teclado y en móvil, se recupera el borrador y no hay saltos al abrir el editor.                                      |
| 2. Ramo, jardín y entrega | Composiciones, isla ilustrada, dibujo de flores, galería del regalo y presentación del destinatario | Dibujo y dedicatorias persisten; vista previa, escena, postal y enlace representan la misma selección; regalos anteriores abren correctamente. |
| 3. Agente Go              | Conversación, propuestas, aplicar y deshacer                                                        | Funciona con acceso real al proveedor; cancelación, cuota, error y respuestas inválidas no rompen ni sobrescriben el borrador.                 |
| 4. Recuerdos personales   | Flor de respuesta del destinatario, fotos y voz                                                     | Invitaciones de escritura acotadas, guardado, lectura y eliminación funcionan sin filtrar la conversación.                                     |
| 5. Pulido y publicación   | Verificación, grabaciones, despliegue y seguimiento                                                 | Flujos principales y pruebas de regresión pasan; hay copia de base, migración y procedimiento de reversión comprobados.                        |

Primera entrega utilizable: fases 0–3. Segunda entrega: fase 4. La fase 5 se aplica a cada publicación. Cada fase tendrá commits pequeños y revisables; este plan no autoriza por sí solo comprar servicios o publicar cambios.

## 12. Verificación

- Unitarias: esquema de regalo, compatibilidad, propuestas del agente, versiones de borrador y límites.
- Integración: PostgreSQL, aislamiento de sesiones, fallos y límites del proveedor, persistencia de archivos cuando se incorporen.
- Navegador: crear manualmente, crear con asistente, descartar, aplicar, deshacer, compartir, recibir, exportar, recargar y recuperar borrador.
- Regresión de parpadeo: grabar transición al editor y al ramo, escribir mientras llega respuesta y cambiar de paso durante una petición; comprobar que no hay fotogramas negros ni crecimiento reiniciado.
- Accesibilidad: foco, teclado, nombres de controles, contraste, movimiento reducido y controles alternativos a gestos 3D.
- Móvil: pantalla estrecha, teclado abierto, orientación y red lenta; identificar explícitamente qué se probó en dispositivo real y qué sólo se simuló.
- Toda revisión web y grabación de navegador utilizará exclusivamente pestañas propias de BrowserOS neo, según la política del proyecto.

## 13. Indicadores de mejora

Medir proporción de creaciones terminadas, abandono por paso, propuestas de IA aplicadas, tiempo hasta primera propuesta útil, errores al guardar y rendimiento de la escena. Empezar con mediciones de referencia; no inventar porcentajes de mejora antes de probar con personas.

Pendientes para una evolución posterior: regalos que se abren en una fecha y biblioteca de regalos. Se decidirán después de validar el creador y la entrega; una fecha futura necesitaría control del servidor y no un simple bloqueo visual.
