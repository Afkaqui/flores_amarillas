import { icon } from "./icons.js";

const flower = `<svg class="reason-flower" viewBox="0 0 48 60" aria-hidden="true" focusable="false">
  <path d="M24 27c-2 10 2 19 0 30M24 47c-9-1-13-7-13-12 8 1 12 5 13 12M24 41c8-1 12-7 12-12-7 1-11 5-12 12" fill="none" stroke="#6d8561" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="#e8c45f">
    <ellipse cx="24" cy="12" rx="5" ry="9"/>
    <ellipse cx="24" cy="12" rx="5" ry="9" transform="rotate(45 24 21)"/>
    <ellipse cx="24" cy="12" rx="5" ry="9" transform="rotate(90 24 21)"/>
    <ellipse cx="24" cy="12" rx="5" ry="9" transform="rotate(135 24 21)"/>
    <ellipse cx="24" cy="12" rx="5" ry="9" transform="rotate(180 24 21)"/>
    <ellipse cx="24" cy="12" rx="5" ry="9" transform="rotate(225 24 21)"/>
    <ellipse cx="24" cy="12" rx="5" ry="9" transform="rotate(270 24 21)"/>
    <ellipse cx="24" cy="12" rx="5" ry="9" transform="rotate(315 24 21)"/>
  </g><circle cx="24" cy="21" r="5" fill="#a37e3e"/>
</svg>`;

export function mountFlowerReasons(root) {
  let reasons = [], selected = -1;
  const heading = document.createElement("p");
  heading.className = "flower-reasons-heading";
  heading.textContent = "Hay algo bonito en cada flor";
  const hint = document.createElement("p");
  hint.className = "flower-reasons-hint";
  hint.textContent = "Toca una y descubre sus palabras.";
  const choices = document.createElement("div");
  choices.className = "flower-reasons-choices";
  const panel = document.createElement("div");
  panel.id = "flower-reason-detail";
  panel.className = "flower-reason-detail hidden";
  const caption = document.createElement("span");
  caption.className = "flower-reason-caption";
  const words = document.createElement("p");
  words.className = "flower-reason-words";
  words.setAttribute("role", "status");
  words.setAttribute("aria-atomic", "true");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "flower-reason-close";
  close.setAttribute("aria-label", "Cerrar estas palabras");
  close.innerHTML = icon("close");
  panel.append(caption, words, close);
  root.replaceChildren(heading, hint, choices, panel);

  function collapse(restoreFocus = true) {
    const previous = choices.children[selected];
    if (restoreFocus && panel.contains(document.activeElement))
      previous?.focus({ preventScroll: true });
    selected = -1;
    panel.classList.add("hidden");
    words.textContent = "";
    for (const button of choices.children)
      button.setAttribute("aria-expanded", "false");
  }

  function reveal(index, scroll = true) {
    if (!reasons[index]) return;
    selected = index;
    for (const [i, button] of [...choices.children].entries())
      button.setAttribute("aria-expanded", String(i === index));
    panel.classList.remove("hidden");
    caption.textContent = `Una flor para ti · ${index + 1} de ${reasons.length}`;
    words.textContent = reasons[index];
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      words.getAnimations().forEach((animation) => animation.cancel());
      words.animate(
        [{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 320, easing: "ease-out" },
      );
    }
    if (scroll) panel.scrollIntoView({ block: "nearest", behavior: "instant" });
  }

  close.onclick = () => collapse();
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selected !== -1) {
      event.preventDefault();
      event.stopPropagation();
      collapse();
    }
  });

  return {
    collapse,
    revealText(text) { reveal(reasons.indexOf(text), true); },
    setReasons(next) {
      if (JSON.stringify(next) === JSON.stringify(reasons)) return;
      collapse(false);
      reasons = [...next];
      root.classList.toggle("hidden", reasons.length === 0);
      choices.replaceChildren();
      reasons.forEach((_, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "flower-reason-choice";
        button.setAttribute("aria-label", `Descubrir las palabras de la flor ${index + 1}`);
        button.setAttribute("aria-controls", panel.id);
        button.setAttribute("aria-expanded", "false");
        button.innerHTML = flower;
        const label = document.createElement("span");
        label.textContent = `Flor ${index + 1}`;
        button.append(label);
        button.onclick = () => selected === index ? collapse() : reveal(index);
        choices.append(button);
      });
    },
  };
}
