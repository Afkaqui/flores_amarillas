# Métricas de Flores Amarillas

La medición comienza al arrancar esta versión del backend. No reconstruye visitas anteriores. Los datos se guardan en la misma base PostgreSQL, separados de los regalos.

## Consultar

Prepara tu clave una vez y carga el archivo de entorno al arrancar:

```sh
node server/scripts/setup-metrics.mjs .env
# Añadir DATABASE_URL y los demás ajustes habituales del servicio.
METRICS_PORT=5184 node --env-file=.env server/index.js
```

El generador utiliza aleatoriedad criptográfica, conserva la clave existente, protege el archivo con permisos 600 y nunca muestra sus valores. Tu clave de entrada está en `METRICS_ADMIN_KEY`, dentro de `.env`. No se incluye en Git, URLs ni archivos públicos. El panel se abre en `http://127.0.0.1:5184`; permite consultar hoy, 7, 30, 90 o 365 días, actualizar y descargar JSON. Se actualiza cada 30 segundos mientras la pestaña está visible.

El listener está limitado a `127.0.0.1`, valida Host y Origin y rechaza solicitudes entre sitios. Exige inicio de sesión para consultar HTML del panel, datos JSON y el código del dashboard. Sin clave válida, el panel no arranca. No está montado en la API pública. Sin `METRICS_PORT`, el panel queda desactivado y se sigue registrando actividad. No publiques este puerto mediante el proxy.

También puedes consultar desde el directorio del proyecto, con el entorno de conexión habitual:

```sh
node --env-file=.env server/metrics-report.js 7
```

En un contenedor ya configurado, el equivalente es `docker compose exec flores-amarillas node --env-file=.env server/metrics-report.js 7` (adapta el nombre del servicio si corresponde). No necesita levantar el panel, pero requiere acceso al entorno privado de conexión a la base. El argumento es el número de días, de 1 a 365.

## Protección

- `METRICS_ADMIN_KEY`: clave aleatoria de 256 bits para entrar. El proceso verifica mediante scrypt y comparación constante; no guarda esta clave en cookies ni en el navegador. Cambiarla y reiniciar revoca las sesiones.
- Sesiones aleatorias, almacenadas como hash en memoria, de 30 minutos; cookies HttpOnly y SameSite=Strict. Cerrar sesión y reiniciar invalidan su acceso. Cinco intentos de entrada por minuto, con concurrencia limitada. Las respuestas llevan `no-store`.
- La protección corresponde al acceso al panel, su API y sus exportaciones. Por decisión del propietario, los contadores de PostgreSQL mantienen su almacenamiento habitual, sin cifrado adicional. El acceso directo a la base sigue controlado por las credenciales del servidor.
- El JSON descargado contiene las cifras consultadas. Guárdalo como archivo privado.
- El panel local usa HTTP en loopback. Cuando se habilite en el VPS, el acceso debe viajar por un túnel SSH cifrado; no debe exponerse su puerto en Internet. Esta revisión no modifica ni despliega el VPS.

## Qué mide

| Medida | Significado |
| --- | --- |
| Visitas | Una página vista cuando la pestaña está activa. Recargar cuenta otra visita. |
| Navegadores/día | Cookies distintas por día y evento, sumadas en el periodo. No equivale a personas únicas. Disponible durante 30 días. |
| Recorrido | Inicio del creador, paso del ramo, carta, apertura del asistente y aplicación de ideas. Se cuenta una llegada por página para cada paso. |
| Regalos y respuestas | Escrituras exitosas en el backend; no acepta estos contadores desde el cliente. |
| Aperturas | El visitante abrió el sobre. Se excluye al autor reconocido por su sesión en regalos del servidor; otro navegador no identifica a la misma persona. |
| Compartir | Copia del enlace o resolución del diálogo nativo. No confirma que otra persona recibió el regalo. |
| Postales | PNG generado y descarga preparada; no confirma escritura en disco. Los errores se conservan también en el JSON. |
| Asistente | Solicitudes exitosas y tokens que reportó el proveedor. Las peticiones fallidas aparecen en HTTP. No es un cálculo de facturación. |
| Archivos | Subidas procesadas y bytes resultantes. |
| HTTP | Solicitudes por categoría de ruta, estados 4xx/5xx, bytes y tiempo hasta terminar la respuesta. Incluye bots, recursos y vistas sociales. |
| Fuentes | Directo, WhatsApp, Instagram, Facebook u otros según referencia o `utm_source`. Las apps pueden omitir la referencia. |
| Existencias | Regalos, archivos y respuestas actualmente guardados. Eliminar un regalo no borra los totales históricos. |

Los pasos son indicadores de actividad, no una cohorte lineal: el asistente puede llevar directamente a la carta. No debe presentarse la división entre aperturas y creaciones como una tasa de conversión de los mismos usuarios. Compara periodos, respuestas y uso de funciones junto con los errores para evaluar resultados.

Los días se calculan en `America/Lima`. El P95 es un intervalo estimado (100 ms, 500 ms, 2 s, 10 s o más), no un percentil exacto. Los bytes de entrada usan Content-Length declarado, limitado a 12 MB por solicitud; los de salida cuentan el cuerpo escrito por Node. No incluyen cabeceras, TLS, tráfico de terceros ni peticiones interrumpidas antes de finalizar.

## Datos y límites

- Las métricas no almacenan cartas, nombres, conversaciones, archivos, URLs completas ni direcciones IP. Las rutas se reducen a categorías sin IDs.
- Una cookie propia `flores_metrics`, HttpOnly y SameSite=Lax, dura 24 horas. En la tabla de navegadores se conserva sólo su hash combinado con el día. El ID de regalo se usa momentáneamente para excluir aperturas del autor, no se incorpora a las dimensiones.
- Se respetan DNT y GPC para eventos del navegador y deduplicación. Permanecen los contadores operativos del servidor. Las métricas no cambian los datos propios que ya necesita guardar un regalo.
- Se mantienen agregados durante 365 días e identificadores diarios durante 30. La limpieza se realiza durante las escrituras periódicas.
- Se escribe en lotes cada 5 segundos. Al cerrar normalmente se vacía la cola; una caída abrupta puede perder el último lote. Una caída de base provoca reintentos con memoria acotada: 500 grupos y 5000 identificadores pendientes. El panel informa fallos y muestras descartadas.
- El endpoint de eventos admite sólo campos y nombres predefinidos, cuerpos de 2 KB y hasta 120 solicitudes por minuto por IP. El límite usa un hash en memoria y no persiste la IP. Los contadores del navegador son orientativos y pueden ser bloqueados o manipulados por un visitante.

## Verificación

`tests/metrics-security.test.mjs` comprueba autenticación, bloqueo sin configuración, límites de intentos, caducidad, revocación, aislamiento de origen.

`tests/metrics.test.mjs` comprueba categorías sin datos privados, aislamiento del panel, persistencia real, deduplicación diaria, volumen y tokens, rechazo de contenido privado y cuerpos grandes, DNT y origen. Usa únicamente una base de pruebas con `FLORES_TEST_DB=1`.
