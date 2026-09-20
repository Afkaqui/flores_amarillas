import {
  normalizeGift,
  COMPOSITIONS,
  RIBBONS,
  PAPERS,
  OCCASIONS,
} from "../shared/gift.js";
import { LETTER_STYLE, LETTER_EXAMPLE } from "./letter-style.js";
import { assertScopeText, scopeError, SCOPE_POLICY } from "./assistant-scope.js";
function validatePatch(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !value.patch ||
    typeof value.patch !== "object"
  )
    throw new Error("invalid-proposal");
  const patch = {},
    input = value.patch;
  for (const [key, limit] of [
    ["mensaje", 360],
    ["para", 28],
    ["de", 28],
  ])
    if (typeof input[key] === "string")
      patch[key] = Array.from(input[key].trim()).slice(0, limit).join("");
  for (const [key, options] of [
    ["cinta", RIBBONS],
    ["papel", PAPERS],
    ["composicion", COMPOSITIONS],
    ["ocasion", OCCASIONS],
  ])
    if (Object.hasOwn(options, input[key])) patch[key] = input[key];
  if (["atardecer", "noche"].includes(input.ambiente))
    patch.ambiente = input.ambiente;
  if (Number.isInteger(input.flores) && input.flores >= 3 && input.flores <= 24)
    patch.flores = input.flores;
  if (!Object.keys(patch).length) throw new Error("invalid-proposal");
  return {
    patch,
    explanation:
      typeof value.explanation === "string"
        ? value.explanation.slice(0, 500)
        : "Preparé esta idea para que puedas darle tu toque.",
  };
}
export function validateProposal(value) {
  if (!value || typeof value !== "object") throw new Error("invalid-proposal");
  const trim = (text, limit) =>
    typeof text === "string"
      ? Array.from(text.trim()).slice(0, limit).join("")
      : "";
  const inputs = Array.isArray(value.options)
    ? value.options.slice(0, 3)
    : [{ label: "Una idea para ti", patch: value.patch }];
  if (!inputs.length) throw new Error("invalid-proposal");
  const options = inputs.map((option, i) => ({
    label: trim(option?.label, 48) || `Idea ${i + 1}`,
    description: trim(option?.description, 140),
    patch: validatePatch(option).patch,
  }));
  const followups = (Array.isArray(value.followups) ? value.followups : [])
    .slice(0, 3)
    .map((item) => ({
      label: trim(item?.label, 48),
      prompt: trim(item?.prompt, 500),
      needsDetail: item?.needsDetail === true,
    }))
    .filter((item) => item.label && item.prompt);
  return {
    patch: options[0].patch,
    options,
    followups,
    explanation:
      trim(value.explanation, 500) ||
      "Elige la idea que más se parezca a lo que sientes.",
  };
}
export async function propose({
  message,
  gift,
  history = [],
  sessionId,
  signal,
  fetcher = fetch,
  key = process.env.OPENCODE_GO_API_KEY || process.env.AGENT_CONNECT_SECRET,
}) {
  if (!key)
    throw Object.assign(
      new Error(
        "Tu cómplice aún no está conectado. Puedes preparar el regalo manualmente.",
      ),
      { status: 503 },
    );
  const d = normalizeGift(gift);
  const { dibujos, fotos, momentos, voz, ...context } = d;
  const conversation = history.slice(-8)
    .filter((item) => ["user", "assistant"].includes(item?.role) && typeof item.content === "string")
    .map(({ role, content }) => ({ role, content: content.slice(0, 6000) }));
  const request = { regalo: context, peticion: String(message).slice(0, 1200) };
  assertScopeText(request);
  for (const item of conversation) assertScopeText(item.content);
  let usage = 0;
  async function complete(messages, maxTokens, temperature) {
    const response = await fetcher(
      "https://opencode.ai/zen/go/v1/chat/completions",
      {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
          "User-Agent": "flores-amarillas/2.0",
          "x-opencode-session": sessionId,
        },
        body: JSON.stringify({
          model: "glm-5.3-flash",
          max_tokens: maxTokens,
          temperature,
          stream: false,
          messages,
        }),
      },
    );
    if (!response.ok)
      throw Object.assign(
        new Error(
          response.status === 429
            ? "Tu cómplice necesita una pausa. Inténtalo más tarde."
            : "El asistente no está disponible en este momento. Puedes seguir escribiendo tu carta y volver a intentarlo más tarde.",
        ),
        {
          status: response.status === 429 ? 429 : 502,
          code: [401, 403].includes(response.status)
            ? "provider_auth"
            : response.status === 429 ? "provider_limit" : "provider_error",
          providerStatus: response.status,
        },
      );
    const body = await response.json();
    const tokens = body.usage?.total_tokens;
    if (Number.isSafeInteger(tokens) && tokens >= 0) usage += tokens;
    if (body.choices?.[0]?.message?.tool_calls?.length ||
        body.choices?.[0]?.message?.function_call ||
        ["length", "tool_calls", "content_filter"].includes(body.choices?.[0]?.finish_reason))
      throw new Error("invalid-proposal");
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length > 18000)
      throw new Error("invalid-proposal");
    return JSON.parse(
      content.replace(/^\s*```(?:json)?\s*/, "").replace(/\s*```\s*$/, ""),
    );
  }
  try {
    const parsed = await complete([
      { role: "system", content: LETTER_STYLE },
      ...LETTER_EXAMPLE,
      ...conversation,
      { role: "user", content: JSON.stringify(request) },
    ], 2800, 0.7);
    if (parsed?.outOfScope === true) throw scopeError();
    const proposal = validateProposal(parsed);
    assertScopeText(proposal);
    // Separate context: the verifier receives data, never the conversation as roles.
    // An unavailable or malformed verifier must not release unchecked text.
    const verdict = await complete([
      { role: "system", content: SCOPE_POLICY },
      { role: "user", content: JSON.stringify({ request, history: conversation, proposal }) },
    ], 80, 0);
    if (!verdict || Array.isArray(verdict) || Object.keys(verdict).length !== 1 ||
        typeof verdict.allowed !== "boolean")
      throw Object.assign(new Error("No pudimos revisar esta idea. Inténtalo de nuevo; tu carta está a salvo."),
        { status: 503, code: "assistant_review" });
    if (!verdict.allowed) throw scopeError();
    return { ...proposal, usage };
  } catch (error) {
    error.usage = usage;
    throw error;
  }
}
