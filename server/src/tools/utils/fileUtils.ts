// 工具共享的文件处理工具函数

// 支持的文本文件扩展名
export const TEXT_EXTENSIONS = [
  // JavaScript/TypeScript
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts",
  // Web
  ".html", ".css", ".scss", ".sass", ".less", ".vue", ".svelte",
  // Data
  ".json", ".yaml", ".yml", ".xml", ".toml",
  // Documentation
  ".md", ".mdx", ".txt", ".rst",
  // Config
  ".env", ".gitignore", ".dockerignore", ".editorconfig",
  // Shell
  ".sh", ".bash", ".zsh", ".fish",
  // Other languages
  ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp",
  ".rb", ".php", ".swift", ".kt", ".scala", ".lua",
  // SQL
  ".sql",
];

/**
 * 判断文件是否是文本文件
 */
export function isTextFile(filename: string): boolean {
  return TEXT_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

/**
 * 判断文件名是否匹配模式
 * @param filename 文件名
 * @param pattern 匹配模式，如 "*.ts" 或 "utils"
 */
export function matchFilePattern(filename: string, pattern?: string): boolean {
  if (!pattern) return true;
  if (pattern.startsWith("*.")) {
    return filename.endsWith(pattern.slice(1));
  }
  return filename.includes(pattern);
}
