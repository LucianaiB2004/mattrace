function cleanRoot(gateway) {
  const root = String(gateway ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(root)) throw new Error("API 网关必须是有效的 HTTP(S) 地址");
  return root;
}

export function requestUrl(config, path) {
  const root = cleanRoot(config.gateway);
  if (config.protocol === "openai-responses") return `${root}/responses`;
  const v1 = root.endsWith("/v1") ? root : `${root}/v1`;
  return path === "models" ? `${v1}/models` : `${v1}/chat/completions`;
}

export function requestBody(config, messages, options = {}) {
  const maxTokens = Number(options.maxTokens) || 4096;
  const stream = Boolean(options.stream);
  if (config.protocol === "openai-responses") {
    return {
      model: String(config.model ?? "").trim(),
      input: messages.map((message) => ({
        role: message.role,
        content: [{ type: "input_text", text: message.content }],
      })),
      max_output_tokens: maxTokens,
      stream,
    };
  }
  return {
    model: String(config.model ?? "").trim(),
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: maxTokens,
    ...(stream ? { stream: true, enable_thinking: false } : {}),
    ...(options.json ? { response_format: { type: "json_object" } } : {}),
  };
}

function chatCompletionText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("模型响应缺少 message.content");
  return content;
}

function responsesText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const chunks = (payload?.output ?? []).flatMap((item) => item?.content ?? [])
    .map((item) => item?.text)
    .filter((value) => typeof value === "string");
  if (!chunks.length) throw new Error("模型响应缺少输出文本");
  return chunks.join("");
}

export async function responseText(protocol, response) {
  const isSse = response.headers?.get?.("content-type")?.includes("text/event-stream");
  if (!isSse) {
    const payload = await response.json();
    return protocol === "openai-responses" ? responsesText(payload) : chatCompletionText(payload);
  }

  const chunks = [];
  for (const line of (await response.text()).split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let event;
    try { event = JSON.parse(data); }
    catch { throw new Error("模型流式响应包含无效事件"); }
    const content = protocol === "openai-responses"
      ? event?.type === "response.output_text.delta" ? event.delta : undefined
      : event?.choices?.[0]?.delta?.content ?? event?.choices?.[0]?.message?.content;
    if (typeof content === "string") chunks.push(content);
  }
  if (!chunks.length) throw new Error(protocol === "openai-responses" ? "模型响应缺少输出文本" : "模型流式响应缺少内容");
  return chunks.join("");
}
