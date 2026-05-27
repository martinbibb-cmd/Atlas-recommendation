import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PDF_DIR = path.resolve(__dirname, '..');
const FORBIDDEN_IMPORT_TARGETS = [
  `${path.sep}src${path.sep}legacy${path.sep}`,
  `${path.sep}src${path.sep}library${path.sep}visualTopologies${path.sep}`,
  `${path.sep}src${path.sep}library${path.sep}visualPrimitives${path.sep}`,
  `${path.sep}src${path.sep}library${path.sep}dev${path.sep}`,
  `${path.sep}src${path.sep}components${path.sep}dev${path.sep}`,
];

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === '__tests__') continue;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(absolutePath);
  }
  return files;
}

function collectImportPaths(filePath: string): string[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const importPaths: string[] = [];
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  let match = importRegex.exec(source);
  while (match != null) {
    importPaths.push(match[1]);
    match = importRegex.exec(source);
  }
  return importPaths;
}

function resolveImportPath(fromFile: string, importPath: string): string {
  if (!importPath.startsWith('.')) return importPath;
  return path.resolve(path.dirname(fromFile), importPath);
}

describe('customer PDF import boundaries', () => {
  it('does not import customer PDF sources from legacy or dev/gallery registries', () => {
    const sourceFiles = collectSourceFiles(PDF_DIR);
    const violations: string[] = [];
    for (const sourceFile of sourceFiles) {
      const imports = collectImportPaths(sourceFile);
      for (const importPath of imports) {
        const resolved = resolveImportPath(sourceFile, importPath);
        if (FORBIDDEN_IMPORT_TARGETS.some((forbiddenPath) => resolved.includes(forbiddenPath))) {
          violations.push(`${path.relative(PDF_DIR, sourceFile)} -> ${importPath}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
