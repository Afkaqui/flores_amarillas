import { track } from "./metrics.js";
import {
  INKS,
  MAX_DRAWINGS,
  normalizeDrawing,
  drawingSVG,
  templateFlower,
  templateDrawing,
  strokePath,
} from "../shared/drawing.js";
import { mountVoicePlayer } from "./media-player.js";
import { bouquetSVG } from "../shared/bouquet.js";
import { normalizeGift } from "../shared/gift.js";
import { abrirModal, cerrarModal, toast } from "./ui.js";
const $ = (s) => document.querySelector(s);
export function initCreator({ getGift, setGift, save, getReceived, onExit }) {
  let step = 0,
    drawings = [],
    photos = [],
    photoNotes = {},
    voice = "",
    revision = 0,
    request = null,
    proposal = null,
    undo = null;
  let selectedOption = null;
  let loadingTimer = null;
  const reducedAssistantMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let proposalBase = "",
    activeStroke = null,
    strokes = [],
    ink = INKS[0],
    width = 4;
  let pendingUploads = 0;
  let recording = null,
    recordingStream = null,
    recordingTimer = null;
  let photoSignature = "";
  const draftVoice = mountVoicePlayer($("#voice-preview"), {
    title: "Tu nota de voz",
    subtitle: "Escúchala antes de enviar tu carta.",
  });
  let letterVoice = null;
  const show = (selector, yes) => $(selector).classList.toggle("hidden", !yes);
  function go(n, focus = true) {
    if (n > 0 && !$("#f-to").value.trim()) {
      n = 0;
      $("#f-to").focus();
    }
    step = Math.max(0, Math.min(2, n));
    if (step > 0) track(step === 1 ? "step_bouquet" : "step_letter");
    $("#gift-form").classList.toggle("letter-mode", step === 2);
    document
      .querySelectorAll("[data-panel]")
      .forEach((el) =>
        el.classList.toggle("hidden", Number(el.dataset.panel) !== step),
      );
    document.querySelectorAll("[data-step]").forEach((el) => {
      if (Number(el.dataset.step) === step)
        el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
    show("#step-next", step < 2);
    show("#gift-submit", step === 2);
    $("#gift-cancel").textContent = step ? "Atrás" : "Volver al jardín";
    if (focus) {
      const h = $(`[data-panel="${step}"] h3`);
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
      $(".creator-layout").scrollTop = 0;
    }
  }
  document
    .querySelectorAll("[data-step]")
    .forEach((b) => (b.onclick = () => go(Number(b.dataset.step))));
  $("#step-next").onclick = () => go(step + 1);
  $("#gift-cancel").onclick = () => {
    if ($("#gift-form").classList.contains("assistant-mode")) closeAssistant();
    else if (step) go(step - 1);
    else onExit();
  };
  $("#gift-form").addEventListener("input", () => revision++);
  $("#gift-form").addEventListener("change", () => revision++);
  $("#gift-form").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      e.preventDefault();
      if (step < 2) go(step + 1);
    }
  });
  document.querySelectorAll("[name=composicion]").forEach((b) =>
    b.addEventListener("change", () => {
      $("#f-size").value = { sencillo: 7, silvestre: 12, abundante: 20 }[
        b.value
      ];
      save();
    }),
  );
  let editingDrawing = null;
  let drawingHistory = [];
  const rememberDrawing = () => {
    drawingHistory.push(structuredClone(strokes));
    if (drawingHistory.length > 35) drawingHistory.shift();
  };
  const canvas = $("#drawing-canvas"),
    ctx = canvas.getContext("2d");
  function paint() {
    ctx.clearRect(0, 0, 600, 600);
    ctx.save();
    ctx.scale(2, 2);
    for (const s of strokes) {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(new Path2D(strokePath(s.points)));
    }
    ctx.restore();
    $("#draw-undo").disabled = !drawingHistory.length;
    $("#draw-clear").disabled = !strokes.length;
  }
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [
      Math.round(
        Math.max(0, Math.min(300, ((e.clientX - r.left) / r.width) * 300)),
      ),
      Math.round(
        Math.max(0, Math.min(300, ((e.clientY - r.top) / r.height) * 300)),
      ),
    ];
  };
  canvas.onpointerdown = (e) => {
    if (strokes.length >= 32) {
      $("#draw-status").textContent =
        "Tu dibujo tiene muchos detalles. Añádelo a la carta o deshaz algún trazo.";
      return;
    }
    if (activeStroke || e.button !== 0) return;
    rememberDrawing();
    canvas.setPointerCapture(e.pointerId);
    activeStroke = { color: ink, width, points: [point(e)] };
    strokes.push(activeStroke);
  };
  canvas.onpointermove = (e) => {
    if (!activeStroke) return;
    const p = point(e),
      last = activeStroke.points.at(-1);
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
    if (activeStroke.points.length >= 80)
      activeStroke.points = activeStroke.points.filter((_, i) => i % 2 === 0);
    activeStroke.points.push(p);
    paint();
  };
  canvas.onpointerup = (e) => {
    if (activeStroke && activeStroke.points.length === 1)
      activeStroke.points.push([
        activeStroke.points[0][0] + 0.5,
        activeStroke.points[0][1] + 0.5,
      ]);
    activeStroke = null;
    paint();
  };
  canvas.onpointercancel = () => {
    activeStroke = null;
    paint();
  };
  INKS.forEach((color, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.setProperty("--ink", color);
    b.className = "ink";
    b.setAttribute(
      "aria-label",
      ["Rosa", "Amarillo", "Coral", "Lavanda", "Verde"][i],
    );
    b.setAttribute("aria-pressed", String(!i));
    b.onclick = () => {
      ink = color;
      $("#ink-colors")
        .querySelectorAll("button")
        .forEach((el) => el.setAttribute("aria-pressed", String(el === b)));
    };
    $("#ink-colors").append(b);
  });
  $("#draw-toggle").onclick = () => {
    show("#drawing-editor", true);
    $("#draw-status").textContent = "";
    paint();
    $("#drawing-editor").scrollIntoView({ block: "nearest" });
  };
  $("#draw-hide").onclick = () => show("#drawing-editor", false);
  $("#draw-width").onclick = (e) => {
    width = width === 4 ? 7 : 4;
    e.currentTarget.setAttribute("aria-pressed", String(width === 7));
  };
  $("#draw-undo").onclick = () => {
    if (drawingHistory.length) strokes = drawingHistory.pop();
    paint();
  };
  $("#draw-clear").onclick = () => {
    rememberDrawing();
    strokes = [];
    paint();
  };
  function startDrawing(kind) {
    rememberDrawing();
    strokes = templateDrawing(kind, ink).strokes;
    $("#draw-status").textContent =
      "Añade tus trazos. Puedes deshacer para volver a tu dibujo anterior.";
    paint();
  }
  $("#draw-template").onclick = () => startDrawing("flower");
  document.querySelectorAll("[data-draw-template]").forEach((button) => {
    button.onclick = () => startDrawing(button.dataset.drawTemplate);
  });
  $("#draw-plant").onclick = () => {
    const flower = normalizeDrawing({ strokes, note: $("#draw-note").value });
    if (!flower) {
      $("#draw-status").textContent =
        "Haz un dibujo o empieza con la flor guía.";
      return;
    }
    if (editingDrawing === null && drawings.length >= MAX_DRAWINGS) {
      $("#draw-status").textContent =
        "Ya tienes seis dibujos. Puedes quitar uno para añadir otro.";
      return;
    }
    if (editingDrawing === null) drawings.push(flower);
    else drawings[editingDrawing] = flower;
    editingDrawing = null;
    $("#draw-plant").textContent = "Añadir a la carta ♡";
    drawingHistory = [];
    revision++;
    strokes = [];
    paint();
    $("#draw-note").value = "";
    $("#draw-status").textContent = "Tu dibujo ya acompaña la carta.";
    save();
    show("#drawing-editor", false);
  };
  function renderDrawings() {
    const list = $("#drawing-list");
    list.replaceChildren();
    drawings.forEach((flower, i) => {
      const card = document.createElement("div");
      card.className = "drawn-flower";
      card.innerHTML = drawingSVG(flower);
      const note = document.createElement("small");
      note.textContent = flower.note || "Hecha por ti";
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "×";
      del.setAttribute("aria-label", `Quitar dibujo ${i + 1}`);
      del.onclick = () => {
        drawings.splice(i, 1);
        if (editingDrawing === i) {
          editingDrawing = null;
          $("#draw-plant").textContent = "Añadir a la carta ♡";
        } else if (editingDrawing !== null && editingDrawing > i)
          editingDrawing--;
        revision++;
        save();
      };
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "drawing-edit";
      edit.textContent = "Editar";
      edit.setAttribute("aria-label", `Editar dibujo ${i + 1}`);
      edit.onclick = () => {
        editingDrawing = i;
        strokes = structuredClone(flower.strokes);
        drawingHistory = [];
        $("#draw-note").value = flower.note;
        $("#draw-plant").textContent = "Guardar mi dibujo ♡";
        $("#draw-toggle").click();
      };
      card.append(note, edit, del);
      list.append(card);
    });
  }
  function refresh(data) {
    $("#preview-name").textContent =
      "Para " + (data.para || "alguien especial");
    $("#preview-message").textContent =
      data.mensaje || "Unas flores. Mil cosas que decir.";
    $("#letter-drawings-preview").innerHTML = drawings
      .slice(0, 3)
      .map(drawingSVG)
      .join("");
    $("#photo-drop").classList.toggle("is-full", photos.length >= 3);
    $("#photo-input").disabled = photos.length >= 3;
    renderDrawings();
    const list = $("#photo-list");
    const signature = photos.join("|");
    if (signature !== photoSignature) {
      photoSignature = signature;
      list.replaceChildren();
      photos.forEach((src, i) => {
        const card = document.createElement("div");
        card.className = "photo-edit-card";
        const img = document.createElement("img");
        img.src = src;
        img.alt = "Recuerdo " + (i + 1);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "photo-remove";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Quitar recuerdo " + (i + 1));
        remove.onclick = () => {
          photos.splice(photos.indexOf(src), 1);
          delete photoNotes[src];
          save();
        };
        const field = document.createElement("label");
        field.className = "photo-caption-field";
        const title = document.createElement("span");
        title.textContent = "¿Qué hace especial este momento?";
        const input = document.createElement("textarea");
        input.maxLength = 120;
        input.rows = 2;
        input.placeholder = "Ese día que no quería que terminara…";
        input.value = photoNotes[src] || "";
        input.dataset.photo = src;
        const count = document.createElement("small");
        count.textContent = input.value.length + "/120";
        input.oninput = () => {
          photoNotes[src] = input.value;
          count.textContent = input.value.length + "/120";
        };
        field.append(title, input, count);
        card.append(img, remove, field);
        list.append(card);
      });
    } else {
      list.querySelectorAll("textarea").forEach((input) => {
        if (document.activeElement !== input) {
          input.value = photoNotes[input.dataset.photo] || "";
          input.nextElementSibling.textContent = input.value.length + "/120";
        }
      });
    }
    show("#voice-preview", !!voice);
    show("#voice-remove", !!voice);
    draftVoice.setSource(voice);
  }
  const session = () =>
    fetch("/api/session", { method: "POST" }).then(async (r) => {
      if (!r.ok) throw new Error("No pudimos conectar. Inténtalo de nuevo.");
      return r.json();
    });
  async function upload(file) {
    pendingUploads++;
    try {
      await session();
      const r = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error || "No se pudo guardar el archivo.");
      return data.url;
    } finally {
      pendingUploads--;
    }
  }
  async function addPhotos(files) {
    const input = $("#photo-input");
    if (pendingUploads) return;
    input.disabled = true;
    $("#photo-drop").classList.add("is-uploading");
    try {
      if (photos.length >= 3)
        throw new Error(
          "Ya tienes tres recuerdos. Quita uno para elegir otro.",
        );
      for (const file of [...files].slice(0, 3 - photos.length)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error("Elige una foto JPG, PNG o WebP.");
        if (file.size > 10 * 1024 * 1024)
          throw new Error("Cada foto puede pesar hasta 10 MB.");
        $("#media-status").textContent = "Guardando tu recuerdo…";
        photos.push(await upload(file));
        save();
      }
      $("#media-status").textContent =
        "Tus fotos están listas para acompañar la carta.";
    } catch (e) {
      $("#media-status").textContent = e.message;
    } finally {
      input.disabled = photos.length >= 3;
      input.value = "";
      $("#photo-drop").classList.remove("is-uploading", "drag-over");
    }
  }
  $("#photo-input").onchange = (e) => addPhotos(e.target.files);
  $("#photo-drop").ondragover = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };
  $("#photo-drop").ondragleave = (e) =>
    e.currentTarget.classList.remove("drag-over");
  $("#photo-drop").ondrop = (e) => {
    e.preventDefault();
    addPhotos(e.dataTransfer.files);
  };
  $("#voice-remove").onclick = () => {
    voice = "";
    draftVoice.setSource("");
    revision++;
    save();
  };
  function stopRecording() {
    if (recording?.state === "recording") recording.stop();
    clearTimeout(recordingTimer);
    recordingStream?.getTracks().forEach((t) => t.stop());
  }
  $("#voice-record").onclick = async () => {
    if (recording?.state === "recording") {
      stopRecording();
      return;
    }
    try {
      if (!navigator.mediaDevices || !window.MediaRecorder)
        throw new Error(
          "Tu navegador no permite grabar aquí. Prueba desde HTTPS.",
        );
      recordingStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const chunks = [];
      recording = new MediaRecorder(recordingStream);
      recording.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recording.onstop = async () => {
        recordingStream.getTracks().forEach((t) => t.stop());
        $("#voice-record").textContent = "● Grabar mi voz";
        $("#voice-record").disabled = true;
        try {
          $("#media-status").textContent = "Guardando tu voz…";
          voice = await upload(
            new Blob(chunks, { type: recording.mimeType.split(";")[0] }),
          );
          revision++;
          save();
          $("#media-status").textContent =
            "Tu nota está lista. Puedes escucharla.";
        } catch (e) {
          $("#media-status").textContent = e.message;
        } finally {
          $("#voice-record").disabled = false;
        }
      };
      recording.start();
      $("#voice-record").textContent = "■ Terminar grabación";
      $("#media-status").textContent =
        "Grabando… se detendrá a los 30 segundos.";
      recordingTimer = setTimeout(stopRecording, 30000);
    } catch (e) {
      recordingStream?.getTracks().forEach((t) => t.stop());
      $("#media-status").textContent = e.message;
    }
  };
  let assistantReturnFocus = null;
  function openAssistant(event) {
    track("assistant_opened");
    assistantReturnFocus = event?.currentTarget || document.activeElement;
    show("#assistant-panel", true);
    $("#gift-form").classList.add("assistant-mode");
    $("#gift-close").setAttribute("aria-label", "Volver al creador");
    $("#gift-cancel").textContent =
      step === 0 ? "Volver a los nombres" : "Volver a mi carta";
    $(".creator-layout").scrollTop = 0;
    $("#assistant-input").focus({ preventScroll: true });
  }
  function closeAssistant(focus = true) {
    request?.abort();
    show("#assistant-panel", false);
    $("#gift-form").classList.remove("assistant-mode");
    $("#gift-close").setAttribute("aria-label", "Cerrar creador");
    go(step, false);
    if (focus && assistantReturnFocus?.isConnected)
      assistantReturnFocus.focus({ preventScroll: true });
    $(".creator-layout").scrollTop = 0;
  }
  $("#assistant-open").onclick = openAssistant;
  $("#assistant-letter").onclick = openAssistant;
  $("#assistant-close").onclick = () => closeAssistant();
  $("#assistant-cancel").onclick = () => request?.abort();
  function history(text, who) {
    const p = document.createElement("p");
    p.className = who;
    p.textContent = text;
    $("#assistant-history").append(p);
    while ($("#assistant-history").children.length > 8)
      $("#assistant-history").firstChild.remove();
    $("#assistant-history").scrollTop = $("#assistant-history").scrollHeight;
  }
  $("#assistant-send").onclick = async () => {
    const message = $("#assistant-input").value.trim();
    if (!message || request) return;
    const controller = new AbortController();
    request = controller;
    const previousVisible = !$("#assistant-proposal").classList.contains(
      "hidden",
    );
    const base = JSON.stringify(getGift());
    const context = selectedOption
      ? `La opción que elegí es «${selectedOption.label}». Este es mi texto actual: ${proposal.mensaje}. Mi petición: ${message.slice(0, 650)}`
      : message;
    show("#assistant-proposal", false);
    show("#assistant-loading", true);
    $("#assistant-loading-label").textContent = selectedOption
      ? "Dándole otra vuelta a tu idea…"
      : "Buscando las palabras para ti…";
    $("#assistant-options").setAttribute("aria-busy", "true");
    $("#assistant-followups").inert = true;
    loadingTimer = setTimeout(() => {
      $("#assistant-loading-label").textContent =
        "Sigo preparando tus ideas. Gracias por esperar…";
    }, 12000);
    $("#assistant-loading").scrollIntoView({
      block: "nearest",
      behavior: reducedAssistantMotion.matches ? "instant" : "smooth",
    });
    $("#assistant-send").disabled = true;
    show("#assistant-cancel", true);
    $("#assistant-status").textContent =
      "Buscando una forma bonita de decirlo…";
    history(message, "from-you");
    try {
      await session();
      if (controller.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      const response = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: context, gift: JSON.parse(base) }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No pudo terminar la propuesta.");
      if (controller.signal.aborted) return;
      history(data.explanation, "from-complice");
      const options = data.options || [
        { label: "Una idea para ti", patch: data.patch },
      ];
      const cards = $("#assistant-options");
      cards.replaceChildren();
      proposalBase = base;
      proposal = null;
      selectedOption = null;
      show("#assistant-selection", false);
      $("#assistant-apply").disabled = true;
      $("#assistant-proposal-text").textContent = data.explanation;
      options.forEach((option, i) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "assistant-option";
        card.style.setProperty("--idea-delay", `${i * 300}ms`);
        card.setAttribute("aria-pressed", "false");
        option.patch = {
          ...option.patch,
          mensaje: option.patch.mensaje ?? getGift().mensaje,
        };
        const originalText = option.patch.mensaje;
        const preview = document.createElement("div");
        preview.className = "option-bouquet";
        preview.innerHTML = bouquetSVG({ ...getGift(), ...option.patch });
        const title = document.createElement("b");
        title.textContent = option.label;
        const desc = document.createElement("small");
        desc.textContent = option.description || "Un detalle a tu manera";
        const letter = document.createElement("p");
        letter.textContent = option.patch.mensaje || getGift().mensaje;
        const choice = document.createElement("span");
        choice.className = "option-choice";
        choice.textContent = "Elegir esta idea";
        card.append(preview, title, desc, letter, choice);
        card.onclick = () => {
          if (request) return;
          const changed = selectedOption !== option;
          selectedOption = option;
          proposal = option.patch;
          selectedOption.originalText = originalText;
          selectedOption.letterElement = letter;
          $("#assistant-selection-title").textContent = option.label;
          $("#assistant-edit").value = proposal.mensaje;
          $("#assistant-edit-count").textContent =
            `${proposal.mensaje.length}/360`;
          $("#assistant-apply").disabled = !proposal.mensaje.trim();
          show("#assistant-selection", true);
          if (changed)
            history(
              `Seleccionaste «${option.label}». Puedes editarla aquí antes de usarla en tu carta.`,
              "selection-message",
            );
          $("#assistant-selection").scrollIntoView({
            block: "nearest",
            behavior: reducedAssistantMotion.matches ? "instant" : "smooth",
          });
          $("#assistant-status").textContent =
            "La idea está elegida. Tu carta cambiará cuando pulses «Usar en mi carta».";
          cards
            .querySelectorAll("button")
            .forEach((b) => b.setAttribute("aria-pressed", String(b === card)));
        };
        cards.append(card);
      });
      const followups = $("#assistant-followups");
      followups.replaceChildren();
      (data.followups || []).forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.label;
        button.onclick = () => {
          if (request) return;
          $("#assistant-input").value = item.prompt;
          $("#assistant-send").click();
        };
        followups.append(button);
      });
      show("#assistant-loading", false);
      show("#assistant-proposal", true);
      $("#assistant-proposal").scrollIntoView({
        block: "start",
        behavior: reducedAssistantMotion.matches ? "instant" : "smooth",
      });
      $("#assistant-status").textContent =
        "Elige la que más se parezca a ti. Puedes afinarla antes de usarla.";
      $("#assistant-input").value = "";
    } catch (e) {
      show("#assistant-proposal", previousVisible);
      $("#assistant-status").textContent =
        e.name === "AbortError"
          ? "Cancelado. Tu regalo sigue como estaba."
          : e.message;
    } finally {
      clearTimeout(loadingTimer);
      show("#assistant-loading", false);
      $("#assistant-options").setAttribute("aria-busy", "false");
      $("#assistant-followups").inert = false;
      request = null;
      $("#assistant-send").disabled = false;
      show("#assistant-cancel", false);
    }
  };
  $("#assistant-edit").oninput = () => {
    if (!proposal || !selectedOption) return;
    proposal.mensaje = $("#assistant-edit").value;
    selectedOption.letterElement.textContent = proposal.mensaje;
    $("#assistant-edit-count").textContent = `${proposal.mensaje.length}/360`;
    $("#assistant-apply").disabled = !proposal.mensaje.trim();
  };
  $("#assistant-reset-edit").onclick = () => {
    if (!selectedOption) return;
    $("#assistant-edit").value = selectedOption.originalText;
    $("#assistant-edit").oninput();
  };
  $("#assistant-change").onclick = () => {
    $("#assistant-options").scrollIntoView({
      block: "start",
      behavior: reducedAssistantMotion.matches ? "instant" : "smooth",
    });
    $("#assistant-options button[aria-pressed=true]")?.focus({
      preventScroll: true,
    });
  };
  $("#assistant-refine").onclick = () => {
    $("#assistant-input").placeholder =
      "Por ejemplo: conserva el inicio y haz el final más cariñoso…";
    $("#assistant-input").focus();
    $("#assistant-input").scrollIntoView({
      block: "center",
      behavior: reducedAssistantMotion.matches ? "instant" : "smooth",
    });
  };
  $("#assistant-apply").onclick = () => {
    if (!proposal || request || !proposal.mensaje.trim()) return;
    if (JSON.stringify(getGift()) !== proposalBase) {
      $("#assistant-status").textContent =
        "Tu regalo cambió mientras preparábamos la idea. Pide otra propuesta para conservar tus cambios.";
      return;
    }
    history(
      `Usaste «${selectedOption.label}» en tu carta, con tus últimos cambios.`,
      "selection-message",
    );
    track("assistant_applied");
    undo = getGift();
    setGift(normalizeGift({ ...undo, ...proposal }));
    save();
    revision++;
    show("#assistant-proposal", false);
    show("#assistant-undo", true);
    proposal = null;
    selectedOption = null;
    $("#assistant-status").textContent =
      "Aplicado. Puedes seguir dándole tu toque.";
    closeAssistant(false);
    go($("#f-to").value.trim() ? 2 : 0);
    toast("Tu idea ya está en la carta. Puedes seguir editándola. ♡");
  };
  $("#assistant-discard").onclick = () => {
    proposal = null;
    selectedOption = null;
    show("#assistant-proposal", false);
  };
  $("#assistant-undo").onclick = () => {
    if (undo) {
      setGift(undo);
      save();
      revision++;
      undo = null;
      show("#assistant-undo", false);
      $("#assistant-status").textContent = "Recuperamos la versión anterior.";
    }
  };
  document.addEventListener("flores:modal", (e) => {
    if (!e.detail.open) {
      if ($("#gift-form").classList.contains("assistant-mode"))
        closeAssistant(false);
      request?.abort();
      draftVoice.pause();
      stopRecording();
    }
  });
  let replyInk = INKS[0],
    replyStrokes = templateFlower().strokes,
    replyCustom = false,
    replyActive = null;
  const replyCanvas = $("#reply-canvas"),
    replyContext = replyCanvas.getContext("2d");
  function paintReply() {
    replyContext.clearRect(0, 0, 600, 600);
    replyContext.save();
    replyContext.scale(2, 2);
    for (const stroke of replyStrokes) {
      replyContext.beginPath();
      replyContext.strokeStyle = stroke.color;
      replyContext.lineWidth = stroke.width;
      replyContext.lineCap = "round";
      replyContext.lineJoin = "round";
      stroke.points.forEach(([x, y], i) =>
        i ? replyContext.lineTo(x, y) : replyContext.moveTo(x, y),
      );
      replyContext.stroke();
    }
    replyContext.restore();
  }
  function replyPoint(e) {
    const r = replyCanvas.getBoundingClientRect();
    return [
      Math.round(
        Math.max(0, Math.min(300, ((e.clientX - r.left) / r.width) * 300)),
      ),
      Math.round(
        Math.max(0, Math.min(300, ((e.clientY - r.top) / r.height) * 300)),
      ),
    ];
  }
  replyCanvas.onpointerdown = (e) => {
    if (replyStrokes.length >= 32) return;
    replyCanvas.setPointerCapture(e.pointerId);
    replyCustom = true;
    replyActive = { color: replyInk, width: 4, points: [replyPoint(e)] };
    replyStrokes.push(replyActive);
  };
  replyCanvas.onpointermove = (e) => {
    if (!replyActive) return;
    const p = replyPoint(e),
      last = replyActive.points.at(-1);
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
    if (replyActive.points.length >= 80)
      replyActive.points = replyActive.points.filter((_, i) => i % 2 === 0);
    replyActive.points.push(p);
    paintReply();
  };
  replyCanvas.onpointerup = () => {
    replyActive = null;
    paintReply();
  };
  replyCanvas.onpointercancel = replyCanvas.onpointerup;
  $("#reply-draw-clear").onclick = () => {
    replyCustom = true;
    replyStrokes = [];
    paintReply();
  };
  $("#reply-draw-undo").onclick = () => {
    replyStrokes.pop();
    paintReply();
  };
  $("#reply-draw-guide").onclick = () => {
    replyCustom = false;
    replyStrokes = templateFlower(replyInk).strokes;
    paintReply();
  };
  paintReply();
  INKS.forEach((color) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = drawingSVG(templateFlower(color));
    b.setAttribute("aria-label", "Elegir flor " + color);
    b.setAttribute("aria-pressed", String(color === replyInk));
    b.onclick = () => {
      replyInk = color;
      if (!replyCustom) replyStrokes = templateFlower(color).strokes;
      paintReply();
      $("#reply-colors")
        .querySelectorAll("button")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    };
    $("#reply-colors").append(b);
  });
  let replyPoll = null;
  let readingReplies = false;
  let repliesNeedRefresh = false;
  let replyVersion = "";
  let activeGift = null;
  const localRead = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  function giftId() {
    return getReceived()?.id || window.__createdGift?.id;
  }
  function management() {
    const id = giftId();
    const token =
      id &&
      (localRead("flores-management-" + id) ||
        (window.__createdGift?.id === id
          ? window.__createdGift.manageToken
          : null));
    return token ? { id, token } : null;
  }
  function updateLastGift() {
    const id = localRead("flores-last-gift");
    if (!id || !/^[a-z0-9]{7}$/.test(id)) return;
    $("#my-gift-open").href = "/r/" + id;
    show("#my-gift-open", true);
  }
  updateLastGift();
  document.addEventListener("flores:gift-saved", () => {
    updateLastGift();
    if (!$("#card-layer").classList.contains("hidden"))
      renderDetails(activeGift || getGift());
  });
  $("#reply-name").value = localRead("flores-reply-name") || "";
  function renderDetails(gift) {
    activeGift = gift;
    const list = $("#island-gallery");
    list.replaceChildren();
    gift.dibujos.forEach((drawing) => {
      const item = document.createElement("figure");
      item.className = "illustrated-note";
      item.innerHTML = drawingSVG(drawing);
      if (drawing.note) {
        const caption = document.createElement("figcaption");
        caption.textContent = drawing.note;
        item.append(caption);
      }
      list.append(item);
    });
    letterVoice?.destroy();
    letterVoice = null;
    const media = $("#gift-media");
    media.replaceChildren();
    if (gift.fotos.length) {
      const album = document.createElement("section");
      album.className = "memory-album";
      album.setAttribute("aria-label", "Nuestros recuerdos en fotos");
      const heading = document.createElement("p");
      heading.className = "album-heading";
      heading.textContent = "PEDACITOS DE LO NUESTRO";
      album.append(heading);
      gift.fotos.forEach((src, i) => {
        const moment = gift.momentos.find((item) => item.foto === src);
        const figure = document.createElement("figure");
        figure.className = "memory-photo";
        const frame = document.createElement("div");
        frame.className = "memory-photo-frame";
        const img = document.createElement("img");
        img.src = src;
        img.alt = moment?.texto || "Un recuerdo compartido " + (i + 1);
        img.loading = "lazy";
        frame.append(img);
        figure.append(frame);
        const caption = document.createElement("figcaption");
        const number = document.createElement("span");
        number.textContent = String(i + 1).padStart(2, "0");
        const words = document.createElement("p");
        words.textContent =
          moment?.texto || "Un momento que quería guardar contigo.";
        caption.append(number, words);
        figure.append(caption);
        album.append(figure);
        img.onerror = () => {
          frame.classList.add("photo-unavailable");
          img.hidden = true;
          const error = document.createElement("span");
          error.textContent =
            "No pudimos cargar esta foto. Recarga para volver a intentarlo.";
          frame.append(error);
        };
      });
      media.append(album);
    }
    if (gift.voz) {
      const player = document.createElement("section");
      media.append(player);
      letterVoice = mountVoicePlayer(player, {
        title: gift.de ? "La voz de " + gift.de : "Un poquito de mi voz",
        subtitle: "Hay cosas que suenan más bonitas así.",
      });
      letterVoice.setSource(gift.voz);
    }
    show("#reply-thread", !!giftId());
    show("#reply-open", false);
    show("#reply-editor", false);
    show("#gift-management", !!management());
    show("#gift-delete", true);
    $("#management-status").textContent = "";
    show("#btn-island", !!giftId());
    show("#gift-delete-confirm", false);
    replyVersion = "";
    if (giftId()) loadReplies();
    clearInterval(replyPoll);
    replyPoll = setInterval(() => {
      if (!document.hidden && !$("#card-layer").classList.contains("hidden"))
        loadReplies(true);
    }, 15000);
  }
  async function loadReplies(quiet = false) {
    const id = giftId();
    if (!id) return;
    if (readingReplies) {
      repliesNeedRefresh = true;
      return;
    }
    readingReplies = true;
    $("#reply-refresh").disabled = true;
    if (!quiet) $("#reply-read-status").textContent = "Buscando respuestas…";
    try {
      const meta = management();
      const response = await fetch(
        "/api/regalos/" + encodeURIComponent(id) + "/respuestas",
        { headers: meta ? { Authorization: "Bearer " + meta.token } : {} },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No pudimos abrir las respuestas.");
      if (id !== giftId()) return;
      const owner = data.isAuthor || !!meta || !getReceived();
      show("#reply-copy", owner);
      show(
        "#reply-open",
        !owner &&
          data.canReply &&
          $("#reply-editor").classList.contains("hidden"),
      );
      if (owner || !data.canReply) show("#reply-editor", false);
      $("#reply-context").textContent = owner
        ? "Este regalo lo creaste tú. Comparte su enlace; su respuesta aparecerá aquí."
        : data.hasReplied
          ? "Tu respuesta ya está aquí, junto a esta carta ♡"
          : activeGift?.permitirRespuesta
            ? "Puedes dejarle un detalle de vuelta, sin crear una cuenta."
            : "Esta carta no tiene respuestas habilitadas.";
      const version = JSON.stringify(data.replies);
      if (version !== replyVersion) {
        replyVersion = version;
        const list = $("#reply-list");
        list.replaceChildren();
        for (const reply of data.replies) {
          const item = document.createElement("article");
          item.className = "reply-item";
          const drawing = document.createElement("div");
          drawing.innerHTML = drawingSVG(reply.flower);
          const words = document.createElement("div");
          const name = document.createElement("b");
          name.textContent = "De " + reply.name;
          const note = document.createElement("p");
          note.textContent =
            reply.flower.note || "Te dejó este detalle con cariño.";
          const date = document.createElement("time");
          date.dateTime = reply.created;
          date.textContent = new Date(reply.created).toLocaleDateString("es", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          words.append(name, note, date);
          item.append(drawing, words);
          list.append(item);
        }
        if (!data.replies.length) {
          const empty = document.createElement("p");
          empty.className = "reply-empty";
          empty.textContent = owner
            ? "Todavía no hay respuestas. Aquí guardaremos ese poquito de cariño que vuelva."
            : "Tu respuesta puede ser la primera.";
          list.append(empty);
        }
      }
      $("#reply-read-status").textContent =
        "Se actualiza mientras lees esta carta.";
    } catch (e) {
      $("#reply-read-status").textContent =
        e.message + " Puedes volver a intentar con ↻.";
    } finally {
      readingReplies = false;
      $("#reply-refresh").disabled = false;
      if (repliesNeedRefresh) {
        repliesNeedRefresh = false;
        loadReplies(true);
      }
    }
  }
  $("#reply-refresh").onclick = () => loadReplies();
  $("#btn-island").onclick = () => {
    $("#btn-letter").click();
    $("#reply-thread").scrollIntoView({
      block: "nearest",
      behavior: reducedAssistantMotion.matches ? "instant" : "smooth",
    });
  };
  $("#reply-copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.origin + "/r/" + giftId());
      $("#reply-read-status").textContent =
        "Enlace copiado. Envíalo a esa persona para que pueda responderte.";
    } catch {
      $("#reply-read-status").textContent =
        "No se pudo copiar. Abre tu regalo y copia su dirección.";
    }
  };
  $("#reply-open").onclick = () => {
    show("#reply-editor", true);
    show("#reply-open", false);
    $("#reply-name").focus();
  };
  $("#reply-cancel").onclick = () => {
    show("#reply-editor", false);
    show("#reply-open", true);
    $("#reply-open").focus();
  };
  $("#reply-note").oninput = () => {
    $("#reply-count").textContent = `${$("#reply-note").value.length}/80`;
  };
  document.querySelectorAll("[data-reply-start]").forEach((button) => {
    button.onclick = () => {
      $("#reply-note").value = button.dataset.replyStart;
      $("#reply-note").oninput();
      $("#reply-note").focus();
    };
  });
  $("#reply-save").onclick = async () => {
    const name = $("#reply-name").value.trim();
    if (!name) {
      $("#reply-status").textContent =
        "Pon tu nombre o apodo para que sepa quién le escribe.";
      $("#reply-name").focus();
      return;
    }
    const flower = normalizeDrawing({
      strokes: replyStrokes,
      note: $("#reply-note").value,
    });
    if (!flower) {
      $("#reply-status").textContent =
        "Añade un dibujo o vuelve a la flor guía para acompañar tus palabras.";
      $(".reply-drawing-tools").open = true;
      return;
    }
    const b = $("#reply-save");
    b.disabled = true;
    b.textContent = "Guardando tu respuesta…";
    $("#reply-status").textContent = "";
    try {
      await session();
      const response = await fetch(
        "/api/regalos/" + encodeURIComponent(giftId()) + "/respuestas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flower, name }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      try {
        localStorage.setItem("flores-reply-name", name);
      } catch {}
      show("#reply-editor", false);
      await loadReplies();
      $("#reply-read-status").textContent =
        "Tu respuesta quedó guardada. Ya pueden verla en esta misma carta ♡";
      $("#reply-list").scrollIntoView({
        block: "nearest",
        behavior: reducedAssistantMotion.matches ? "instant" : "smooth",
      });
    } catch (e) {
      $("#reply-status").textContent = e.message;
    } finally {
      b.disabled = false;
      b.textContent = "Dejar mi respuesta ♡";
    }
  };
  $("#gift-delete").onclick = () => {
    show("#gift-delete-confirm", true);
    $("#gift-delete-cancel").focus();
  };
  $("#gift-delete-cancel").onclick = () => {
    show("#gift-delete-confirm", false);
    $("#gift-delete").focus();
  };
  $("#gift-delete-yes").onclick = async () => {
    const meta = management();
    if (!meta) return;
    const b = $("#gift-delete-yes");
    b.disabled = true;
    $("#gift-delete-cancel").disabled = true;
    $("#management-status").textContent = "Eliminando el regalo…";
    try {
      const response = await fetch(
        "/api/regalos/" + encodeURIComponent(meta.id),
        {
          method: "DELETE",
          headers: { Authorization: "Bearer " + meta.token },
        },
      );
      if (!response.ok)
        throw new Error("No se pudo eliminar. Puedes intentarlo otra vez.");
      try {
        localStorage.removeItem("flores-management-" + meta.id);
        if (localRead("flores-last-gift") === meta.id)
          localStorage.removeItem("flores-last-gift");
      } catch {}
      window.__createdGift = null;
      clearInterval(replyPoll);
      show("#gift-delete-confirm", false);
      show("#gift-delete", false);
      show("#reply-thread", false);
      show("#my-gift-open", false);
      $("#management-status").textContent =
        "Regalo eliminado. Su enlace ya no está disponible.";
      document.dispatchEvent(
        new CustomEvent("flores:gift-deleted", { detail: { id: meta.id } }),
      );
    } catch (e) {
      $("#management-status").textContent = e.message;
    } finally {
      b.disabled = false;
      $("#gift-delete-cancel").disabled = false;
    }
  };
  new MutationObserver(() => {
    if ($("#card-layer").classList.contains("hidden")) letterVoice?.pause();
  }).observe($("#card-layer"), {
    attributes: true,
    attributeFilter: ["class"],
  });
  go(0, false);
  return {
    pending: () => pendingUploads > 0 || recording?.state === "recording",
    read: () => ({
      dibujos: drawings,
      fotos: photos,
      momentos: photos.map((foto) => ({ foto, texto: photoNotes[foto] || "" })),
      voz: voice,
      composicion: $("#gift-form input[name=composicion]:checked").value,
      permitirRespuesta: $("#f-reply").checked,
    }),
    load(data) {
      editingDrawing = null;
      strokes = [];
      drawingHistory = [];
      $("#draw-note").value = "";
      $("#draw-plant").textContent = "Añadir a la carta ♡";
      show("#drawing-editor", false);
      drawings = structuredClone(data.dibujos || []);
      photos = [...(data.fotos || [])];
      photoNotes = Object.fromEntries(
        (data.momentos || []).map((item) => [item.foto, item.texto]),
      );
      voice = data.voz || "";
      $("#f-reply").checked = !!data.permitirRespuesta;
      $(
        '#gift-form input[name=composicion][value="' +
          (data.composicion || "silvestre") +
          '"]',
      ).checked = true;
      refresh(data);
    },
    refresh,
    go,

    renderLetter(data) {
      renderDetails(data);
    },
  };
}
