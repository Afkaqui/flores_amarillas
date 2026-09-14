# Revisión local — 14 de septiembre de 2026

Esta revisión corresponde al asistente, la carta unificada y sus respuestas. No declara cerrado todo el plan V2. Producción sigue sin desplegarse.

| Recorrido                    | Verificación realizada                                                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Espera del asistente         | Carga controlada en BrowserOS: flor animada, indicadores y tres tarjetas de espera. Sin porcentajes de progreso ficticios.                                                                                           |
| Llegada de ideas             | Tres tarjetas con entrada de 1 segundo y retrasos de 0, 0,3 y 0,6 segundos. CSS contempla movimiento reducido.                                                                                                       |
| Elegir y editar              | Mensaje de selección en conversación; edición de la opción sin cambiar la carta. Cambiar de tarjeta y volver conserva el texto editado.                                                                              |
| Refinar                      | Petición posterior incluye la opción elegida y su texto editado; comprobado con respuesta controlada en navegador. El acceso real a Go y sus tres propuestas se comprobó en la revisión anterior.                    |
| Cancelar, aplicar y deshacer | Cancelar recupera la opción editada y detiene la espera. Aplicar usa el texto editado; deshacer recupera la carta anterior.                                                                                          |
| Recibir                      | Texto, dibujos con dedicatoria, medios y respuestas comparten la carta. Eliminada la segunda pantalla de detalles.                                                                                                   |
| Responder                    | Regalo temporal creado desde una sesión independiente; envío desde BrowserOS y lectura desde la sesión autora. Firma y mensaje visibles, persistentes tras recargar.                                                 |
| Separar autor y destinatario | API rechaza al autor con 403; su interfaz muestra compartir/leer. Otra sesión puede responder; una segunda respuesta desde ella obtiene 409. No verifica identidad entre dispositivos.                               |
| Volver al regalo             | El enlace al último regalo se guarda en el navegador. El token local de gestión identifica al autor cuando vuelve por ese enlace.                                                                                    |
| Eliminar                     | Confirmación integrada: cancelar conserva; confirmar elimina sólo el regalo temporal. Mensaje de resultado y retirada de acciones del enlace eliminado. Sin alert/confirm/prompt nativos en el código de aplicación. |
| Datos y compatibilidad       | 14 pruebas automatizadas pasan entre API, PostgreSQL, esquema, propuestas e imagen social; además, comprobaciones de escape.                                                                                         |

Las respuestas se consultan cada 15 segundos sólo cuando la carta está visible y la pestaña activa; también existe actualización manual. Se conserva el formulario ante errores de envío. El apodo se recuerda localmente y la firma se guarda con la respuesta: esta información es visible para quien tenga el enlace.

Pendiente del plan general: revisión en dispositivo móvil real, grabación completa de regresión del parpadeo y mediciones de rendimiento/accesibilidad. La confirmación visual de estas pantallas no sustituye esas pruebas. Los regalos temporales usados en esta revisión se eliminaron.

## Fotos, voz, dibujos y música

- Las fotos se muestran completas con una dedicatoria opcional de hasta 120 caracteres. Las frases se guardan asociadas a su archivo y sobreviven al JSON y a la API. Editar una frase conserva el foco y la posición del cursor.
- La nota de voz usa un reproductor propio con duración, avance, pausa, carga cancelable y reintento. Se comprobó la entrega HTTP/Range del Ogg; la escucha real queda pendiente de la prueba del usuario, porque BrowserOS mantuvo las pestañas de revisión en segundo plano.
- La postal incluye razones, dibujos, fotos y dedicatorias. Si hay voz, incluye el enlace del regalo para escucharla. Comprobado el renderizado de una postal temporal de 1200 × 2295 sin recortar la foto. La vista temporal usada para inspección no forma parte del código ni se abre al descargar.
- «Dibújale algo» vuelve a estar activo por petición del usuario. Plantillas de flor, corazón y destello; trazos suavizados compartidos por canvas y SVG. Verificados en BrowserOS: limpiar y deshacer recuperan exactamente el lienzo, editar sustituye el dibujo en vez de duplicarlo y la carta muestra una sola nota con su dedicatoria actualizada.
- Música activada por defecto, con reintento en el primer gesto si se bloquea el autoplay y opción de silenciar. La reproducción real depende del permiso del navegador; el estado de YouTube no se marca como reproduciendo hasta recibir su evento.
- Después de los cambios en dibujos, 14 pruebas focalizadas pasan (esquema, enlaces, propuestas, OpenGraph y renderizado de las tres plantillas). La revisión anterior de medios incluyó 15 pruebas con API y PostgreSQL, todas correctas.

No se ha desplegado esta revisión al VPS. Siguen pendientes las comprobaciones generales de dispositivo móvil real, escucha y regresión de rendimiento indicadas arriba.

## Consistencia de controles y límites del creador

- `css/controls.css` centraliza alturas, tipografía, foco, radios, separación y tamaños de cierre. Inputs y selects de 48 px; acciones secundarias y cierres con área de 44 px. El foco de los campos queda dentro del borde.
- El ancho del modal se calcula sobre su espacio disponible, descontando los márgenes. La zona central es la única que se desplaza; el encabezado y las acciones permanecen accesibles. Cambiar de paso vuelve al inicio de esa zona.
- BrowserOS: los tres pasos no presentan desbordamiento horizontal con contenedores de 320, 390, 768 y 1024 px. Con dibujo y asistente abiertos, comprobados límites y pie accesible en 390 × 844, 320 × 568 y 768 × 500. Cierres medidos en 44 × 44; campos y select en 48 px. Estas medidas de contenedor no sustituyen una prueba en teléfono físico.
- Se restauró el tamaño normal tras la revisión; no se añadieron pantallas ni vistas superpuestas al producto.

## Postal, inspiración y métricas

- La postal adopta la composición de la carta: marfil, texto alineado a la izquierda, Fraunces, firma Caveat y notas dibujadas con cinta. Las fotos mantienen su proporción. Se inspeccionó un PNG real; el caso máximo con seis dibujos y tres fotos generó 1200 × 8018 px sin texto fuera del lienzo. La descarga no inserta una copia de la carta en la pantalla.
- «Un poquito de inspiración» abre una vista dedicada dentro del creador. Oculta pasos, vista previa y acciones de continuación mientras se conversa. Volver y el cierre recuperan el paso anterior y sus nombres; aplicar conduce a la carta editable cuando ya hay destinatario.
- Métricas agregadas en PostgreSQL, panel exclusivo de loopback y exportación JSON. Contadores de actividad, volumen, errores, latencia y tokens, con sus límites explicados en `METRICAS.md`.
- La suite con base aislada suma 19 pruebas correctas. La revisión de BrowserOS comprobó que el modo asistente no deja visibles los otros pasos ni el botón Continuar; también se inspeccionó el panel local.

Esta revisión sigue siendo local; no se desplegó al VPS. Se mantienen las limitaciones de dispositivo físico, escucha y regresión general indicadas anteriormente.
