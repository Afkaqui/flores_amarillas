// SVG symbols are served locally and never depend on an OS emoji font.
const names = new Set(["arrow-up-right", "arrow-down", "heart", "close", "plus", "minus", "music", "music-off", "sun", "moon", "rotate", "undo", "sparkles", "flower", "flower-stem", "aster", "bouquet", "pen", "image", "waveform", "microphone", "stop", "play", "pause", "loader", "check"]);
export function icon(name) {
  if (!names.has(name)) throw new Error("Unknown interface icon");
  return `<svg class="ui-icon${name === "loader" ? " is-spinning" : ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/shared/icons.svg?v=20260915#${name}"></use></svg>`;
}
export function setIconContent(element, name, text = "", { leading = false } = {}) {
  element.innerHTML = icon(name);
  if (text) {
    const label = document.createTextNode(text);
    if (leading) element.append(label);
    else element.prepend(label);
  }
}
