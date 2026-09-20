document.querySelector("#login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#submit"),
    field = document.querySelector("#key"),
    status = document.querySelector("#status");
  button.disabled = true;
  button.textContent = "Comprobando tu clave…";
  status.textContent = "";
  try {
    const response = await fetch("/metrics/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: field.value }),
      signal: AbortSignal.timeout(10000),
    });
    field.value = "";
    if (response.ok) {
      location.replace("/metrics");
      return;
    }
    const data = await response.json();
    status.textContent = data.error || "No se pudo entrar. Inténtalo otra vez.";
  } catch {
    field.value = "";
    status.textContent = "No se pudo conectar. Inténtalo otra vez.";
  } finally {
    button.disabled = false;
    button.textContent = "Entrar a mis métricas";
  }
});
