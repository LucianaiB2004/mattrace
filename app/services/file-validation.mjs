export const SUPPORTED_EXTENSIONS = Object.freeze(["pdf", "docx", "txt", "md"]);
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_FILES = 10;

function extensionOf(name) {
  return String(name ?? "").split(".").pop()?.toLowerCase() ?? "";
}

function identityOf(file) {
  return `${String(file.name).toLowerCase()}::${file.size}`;
}

export function validateFiles(files, existing = []) {
  const accepted = [];
  const rejected = [];
  const identities = new Set(existing.map(identityOf));

  for (const file of Array.from(files ?? [])) {
    const extension = extensionOf(file.name);
    let code = null;
    let message = null;
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      code = "unsupported-type";
      message = `不支持 ${extension ? `.${extension}` : "无扩展名"} 文件`;
    } else if (file.size > MAX_FILE_SIZE) {
      code = "too-large";
      message = "单个文件不能超过 50 MB";
    } else if (identities.has(identityOf(file))) {
      code = "duplicate";
      message = "同名且同大小的文件已存在";
    } else if (existing.length + accepted.length >= MAX_FILES) {
      code = "workspace-full";
      message = "工作区最多保留 10 个文件";
    }

    if (code) rejected.push({ file, code, message });
    else {
      accepted.push(file);
      identities.add(identityOf(file));
    }
  }
  return { accepted, rejected };
}
