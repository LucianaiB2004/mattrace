const STORAGE_KEY = "mattrace.provider.v1";

function normalize(config, defaults) {
  const gateway = String(config?.gateway ?? "").trim().replace(/\/+$/, "");
  const model = String(config?.model ?? "").trim();
  if (!/^https?:\/\//i.test(gateway) || !model) return { ...defaults };
  return { gateway, model, apiKey: String(config?.apiKey ?? "").trim() };
}

export function loadProvider(storage, defaults) {
  try { return normalize(JSON.parse(storage?.getItem(STORAGE_KEY) || "null"), defaults); }
  catch { return { ...defaults }; }
}

export function saveProvider(storage, config) {
  const normalized = normalize(config, config);
  storage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearProviderKey(storage, defaults) {
  const current = loadProvider(storage, defaults);
  return saveProvider(storage, { ...current, apiKey: "" });
}
