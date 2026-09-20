export function mountDetailAccordions(root, { onChange = () => {} } = {}) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const states = new Map();

  function setOpen(detail, open, { immediate = false } = {}) {
    const state = states.get(detail);
    if (state.open === open && !immediate)
      return state.pending?.done || Promise.resolve(true);

    const start = detail.getBoundingClientRect().height;
    state.pending?.cancel();
    state.open = open;
    state.summary.setAttribute("aria-expanded", String(open));
    state.content.forEach((element) => { element.inert = !open; });
    onChange(detail, open);

    detail.style.height = "";
    detail.open = open;
    const end = detail.getBoundingClientRect().height;
    if (immediate || reducedMotion.matches || Math.abs(end - start) < 1)
      return Promise.resolve(true);

    // Keep the contents mounted until the closing motion has finished.
    detail.open = true;
    detail.style.height = `${start}px`;
    const drawingOpening = open && detail.id === "drawing-detail";
    const duration = drawingOpening ? 800 : 380;
    const animation = detail.animate(
      [{ height: `${start}px` }, { height: `${end}px` }],
      {
        duration,
        easing: drawingOpening ? "cubic-bezier(.4,0,.2,1)" : "cubic-bezier(.22,.61,.36,1)",
        fill: "both",
      },
    );
    let resolve, timer, settled = false;
    const done = new Promise((finish) => { resolve = finish; });
    const settle = (complete) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      animation.cancel();
      if (complete) {
        detail.open = state.open;
        detail.style.height = "";
      }
      state.pending = null;
      resolve(complete);
    };
    state.pending = {
      done,
      cancel: () => settle(false),
      finish: () => settle(true),
    };
    animation.onfinish = state.pending.finish;
    // Background tabs can suspend animation events.
    timer = setTimeout(state.pending.finish, duration + 120);
    return done;
  }

  root.querySelectorAll(":scope > details").forEach((detail) => {
    const summary = detail.querySelector("summary");
    const content = [...detail.children].filter((element) => element !== summary);
    states.set(detail, { open: detail.open, summary, content, pending: null });
    summary.setAttribute("aria-expanded", String(detail.open));
    content.forEach((element) => { element.inert = !detail.open; });
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      setOpen(detail, !states.get(detail).open);
    });
  });
  const finishAll = () => states.forEach((state) => state.pending?.finish());
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) finishAll();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finishAll();
  });
  return { setOpen };
}
