import { transform } from 'esbuild';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, sep } from 'path';

// 获取项目根目录
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export async function load(url, context, defaultLoad) {
  // 转换文件 URL 为路径
  let filePath;
  try {
    filePath = fileURLToPath(url);
  } catch {
    // 如果不是有效的 file:// URL，使用默认加载
    return defaultLoad(url, context, defaultLoad);
  }

  // 如果是 .js 文件且在 src/ui 目录下，转换 JSX
  const uiPath = `src${sep}ui`;
  if (filePath.includes(uiPath) && filePath.endsWith('.js')) {
    try {
      const source = await readFile(filePath, 'utf-8');
      const result = await transform(source, {
        loader: 'jsx',
        format: 'esm',
        jsx: 'automatic',
      });

      return {
        format: 'module',
        source: result.code,
        shortCircuit: true,
      };
    } catch (error) {
      // 如果转换失败，回退到默认加载
    }
  }

  return defaultLoad(url, context, defaultLoad);
}
