export function aiProvider(config = {}, env = process.env) {
  const selected = config.provider || env.AI_PROVIDER || "sarvam";
  if (!["sarvam", "gemini"].includes(selected))
    throw new Error("Choose AI_PROVIDER=sarvam or gemini.");
  const gemini = selected === "gemini";
  return {
    id: selected,
    name: gemini ? "Gemini" : "Sarvam",
    key: config.key || (gemini ? env.GEMINI_API_KEY : env.SARVAM_API_KEY),
    model:
      config.model ||
      (gemini
        ? env.GEMINI_CHAT_MODEL || "gemini-3.8-flash"
        : env.SARVAM_CHAT_MODEL || "sarvam-105b"),
    maxTokens: Math.max(
      512,
      Math.min(
        16384,
        Number(gemini ? env.GEMINI_MAX_TOKENS : env.SARVAM_MAX_TOKENS) ||
          (gemini ? 8192 : 4096),
      ),
    ),
  };
}
