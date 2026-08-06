import JSZip from "jszip";
import { SKILL_FILE_SOURCES } from "./skill-files.generated.mjs";

const STORAGE_KEY = "mattrace.skill.material-evidence-extractor.v1";
const WORKSPACE_KEY = "mattrace.skill.material-evidence-extractor.workspace.v1";

export const SKILL_FILES = SKILL_FILE_SOURCES;
export const DEFAULT_SKILL_CONTENT = SKILL_FILES.find((file) => file.path === "SKILL.md").content;

export function summarizeSkillFiles(files = SKILL_FILES) {
  return Object.fromEntries(["contract", "example", "code"].map((category) => [category, files.filter((file) => file.category === category).length]));
}

function assertSafeContent(content) {
  const normalized = String(content ?? "").trim();
  if (!normalized) throw new Error("Skill 内容不能为空");
  if (/\b(?:api[_ -]?key|token|secret)\s*[:=]\s*(?:sk-|[A-Za-z0-9_-]{16,})/i.test(normalized)) {
    throw new Error("Skill 内容不能包含 API Key 或其他敏感凭证");
  }
  return normalized;
}

export function loadSkill(storage) {
  return storage?.getItem(STORAGE_KEY) || DEFAULT_SKILL_CONTENT;
}

export function saveSkill(storage, content) {
  const safeContent = assertSafeContent(content);
  storage?.setItem(STORAGE_KEY, safeContent);
  return safeContent;
}

export function resetSkill(storage) {
  storage?.removeItem(STORAGE_KEY);
  return DEFAULT_SKILL_CONTENT;
}

export function buildSkillDownload(content) {
  return { filename: "SKILL.md", content: assertSafeContent(content), mime: "text/markdown" };
}

export function loadSkillWorkspace(storage) {
  let overrides = {};
  try { overrides = JSON.parse(storage?.getItem(WORKSPACE_KEY) || "{}"); } catch { overrides = {}; }
  const legacy = storage?.getItem(STORAGE_KEY);
  if (legacy && !overrides["SKILL.md"]) overrides["SKILL.md"] = legacy;
  return { files: SKILL_FILES.map((file) => ({ ...file, content: overrides[file.path] ?? file.content })) };
}

export function saveSkillFile(storage, path, content) {
  const file = SKILL_FILES.find((item) => item.path === path);
  if (!file) throw new Error("Skill 文件不存在");
  if (!file.editable) throw new Error("该 Skill 文件为只读");
  const safe = assertSafeContent(content);
  const workspace = loadSkillWorkspace(storage);
  const overrides = Object.fromEntries(workspace.files.filter((item) => item.editable).map((item) => [item.path, item.path === path ? safe : item.content]));
  storage?.setItem(WORKSPACE_KEY, JSON.stringify(overrides));
  if (path === "SKILL.md") storage?.setItem(STORAGE_KEY, safe);
  return safe;
}

export function resetSkillWorkspace(storage) {
  storage?.removeItem(WORKSPACE_KEY);
  storage?.removeItem(STORAGE_KEY);
  return loadSkillWorkspace(storage);
}

export async function buildSkillZip(workspace) {
  const zip = new JSZip();
  const root = zip.folder("material-evidence-extractor");
  for (const file of workspace.files) root.file(file.path, assertSafeContent(file.content));
  return zip.generateAsync({ type: "blob" });
}
