const q = (s) => document.querySelector(s),
  n = (value) => Number(value || 0).toLocaleString("es-PE");
const bytes = (value) =>
  value >= 1048576
    ? (value / 1048576).toFixed(1) + " MB"
    : value >= 1024
      ? (value / 1024).toFixed(1) + " KB"
      : n(value) + " B";
const labels = {
  home: "Portada",
  gift_page: "Página del regalo",
  gifts: "Crear regalo",
  gift: "Datos del regalo",
  replies: "Respuestas",
  assistant: "Asistente",
  upload: "Subidas",
  session: "Sesiones",
  media: "Archivos",
  preview: "Vista social",
  assets: "Recursos",
  other: "Otras",
};
let latest;
function element(tag, text) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
}
function tile(title, value, note) {
  const e = element("div");
  e.className = "tile";
  e.append(
    element("span", title),
    element("strong", value),
    element("small", note),
  );
  q("#cards").append(e);
}
function row(target, values) {
  const r = element("tr");
  values.forEach((v) => r.append(element("td", v)));
  q(target).append(r);
}
function stage(target, label, count, max) {
  const r = element("div");
  r.className = "stage";
  const track = element("div");
  track.className = "track";
  const bar = element("div");
  bar.className = "bar";
  bar.style.width = (max ? (count / max) * 100 : 0) + "%";
  track.append(bar);
  r.append(element("span", label), track, element("b", n(count)));
  q(target).append(r);
}
async function refresh() {
  q("#refresh").disabled = true;
  q("#status").textContent = "Consultando actividad…";
  try {
    const r = await fetch("/api/metrics?days=" + q("#days").value);
    if (!r.ok) throw new Error();
    latest = await r.json();
    for (const id of ["cards", "stages", "daily", "http", "sources", "notes"])
      q("#" + id).replaceChildren();
    const d = latest,
      e = d.totals.events;
    tile("Visitas", n(e.page_view), "Páginas vistas con el navegador activo");
    tile(
      "Regalos creados",
      n(e.gift_created),
      "Guardados correctamente en el servidor",
    );
    tile("Aperturas", n(e.gift_opened), "El visitante abrió el sobre");
    tile("Respuestas", n(e.reply_created), "Respuestas guardadas");
    tile(
      "Postales generadas",
      n(e.postcard_saved),
      "Descarga preparada por el navegador",
    );
    tile(
      "Ideas del asistente",
      n(e.assistant_success),
      n(d.totals.tokens) + " tokens de uso reportado",
    );
    tile(
      "Archivos subidos",
      n(e.media_uploaded),
      bytes(d.totals.uploadedBytes) + " procesados",
    );
    tile(
      "Navegadores/día",
      d.period.days <= 30 ? n(d.browserDays.page_view) : "—",
      d.period.days <= 30
        ? "Estimación diaria, no personas únicas"
        : "Disponible sólo para los últimos 30 días",
    );
    const stages = [
      ["creator_started", "Empezaron un regalo"],
      ["step_bouquet", "Llegaron al ramo"],
      ["step_letter", "Llegaron a la carta"],
      ["assistant_opened", "Abrieron inspiración"],
      ["assistant_applied", "Aplicaron una idea"],
      ["gift_created", "Guardaron un regalo"],
      ["gift_shared", "Compartieron o copiaron"],
      ["gift_opened", "Abrieron un sobre"],
      ["reply_created", "Dejaron una respuesta"],
    ];
    const max = Math.max(1, ...stages.map(([key]) => e[key] || 0));
    stages.forEach(([key, label]) => stage("#stages", label, e[key] || 0, max));
    if (!d.daily.length)
      row("#daily", ["Sin actividad en este periodo", "—", "—", "—", "—"]);
    d.daily.forEach((v) =>
      row("#daily", [v.day, n(v.visits), n(v.gifts), n(v.opens), n(v.replies)]),
    );
    for (const [key, v] of Object.entries(d.totals.http))
      row("#http", [
        labels[key] || key,
        n(v.requests),
        n(v.rejected),
        n(v.errors),
        n(v.meanMs) + " ms",
        v.p95,
        bytes(v.input),
        bytes(v.output),
      ]);
    const sources = d.totals.sources,
      sourceMax = Math.max(1, ...Object.values(sources));
    for (const [key, label] of Object.entries({
      direct: "Directo",
      whatsapp: "WhatsApp",
      instagram: "Instagram",
      facebook: "Facebook",
      other: "Otros",
    }))
      stage("#sources", label, sources[key] || 0, sourceMax);
    d.notes.forEach((note) => q("#notes").append(element("li", note)));
    q("#stock").textContent =
      "Actualmente guardados: " +
      n(d.stock.gifts) +
      " regalos · " +
      n(d.stock.files) +
      " archivos · " +
      n(d.stock.replies) +
      " respuestas. " +
      n(d.stock.with_photos) +
      " regalos con fotos y " +
      n(d.stock.with_voice) +
      " con voz. Las métricas históricas permanecen aunque se elimine un regalo.";
    q("#status").textContent =
      d.period.start +
      " → " +
      d.period.end +
      " · Actualizado " +
      new Date().toLocaleTimeString("es-PE") +
      " · Medición desde " +
      new Date(d.started).toLocaleDateString("es-PE") +
      (d.health.failedFlushes
        ? " · Aviso: " +
          d.health.failedFlushes +
          " fallos de escritura; reintento automático."
        : "") +
      (d.health.dropped
        ? " · " +
          d.health.dropped +
          " muestras descartadas por límite de memoria."
        : "");
    q("#status").classList.remove("error");
  } catch {
    q("#status").textContent =
      "No se pudieron cargar las métricas. Puedes volver a actualizar.";
    q("#status").classList.add("error");
  } finally {
    q("#refresh").disabled = false;
  }
}
q("#refresh").onclick = refresh;
q("#days").onchange = refresh;
q("#export").onclick = () => {
  if (!latest) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(latest, null, 2)], { type: "application/json" }),
  );
  const a = element("a");
  a.href = url;
  a.download = "flores-metricas-" + latest.period.end + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
refresh();
setInterval(() => {
  if (!document.hidden) refresh();
}, 30000);
