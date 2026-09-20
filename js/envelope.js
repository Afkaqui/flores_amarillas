const OPEN_DURATION = 2600;

export function openEnvelope(envelope, reducedMotion = false) {
  const paper = envelope.querySelector(".envelope-paper");
  const reveal = envelope.closest("#reveal");
  envelope.style.setProperty("--envelope-open-duration", `${OPEN_DURATION}ms`);
  if (reducedMotion) {
    reveal.classList.add("is-opening");
    envelope.classList.add("opening");
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      paper.removeEventListener("animationend", onEnd);
      // Background tabs may suspend animation events. Keep the final pose.
      for (const animation of envelope.getAnimations({ subtree: true }))
        animation.finish();
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === paper && event.animationName === "letter-leaves-envelope")
        finish();
    };
    const fallback = setTimeout(finish, OPEN_DURATION + 600);
    paper.addEventListener("animationend", onEnd);
    reveal.classList.add("is-opening");
    envelope.classList.add("opening");
  });
}
