/**
 * scanPackageReader.ts
 *
 * Reads an Atlas Scan export package from a browser FileList.
 *
 * A valid Atlas Scan package contains:
 *   - manifest.json      (required)
 *   - scan_bundle.json   (required)
 *   - evidence files     (optional, listed in manifest.evidenceFiles)
 *
 * The user selects all files from the package folder via a file input with
 * the `multiple` attribute (or `webkitdirectory`).  This module finds the
 * required files by name, reads them, and returns a structured result.
 *
 * Raw package contents stay inside this module — callers receive the parsed
 * manifest and bundle as plain unknown values that are then validated by
 * dedicated validators.
 */

// ─── Result types ─────────────────────────────────────────────────────────────

/**
 * A successfully read package.
 *
 * manifestRaw  — parsed manifest.json content
 * bundleRaw    — parsed scan_bundle.json content
 * evidenceCount — number of evidence files detected (matched to manifest list)
 * evidenceNames — filenames of detected evidence files
 */
export interface ScanPackageReadSuccess {
  ok: true;
  manifestRaw: unknown;
  bundleRaw: unknown;
  evidenceCount: number;
  evidenceNames: string[];
}

/**
 * A failed package read — missing or malformed required files.
 */
export interface ScanPackageReadFailure {
  ok: false;
  errors: string[];
}

export type ScanPackageReadResult =
  | ScanPackageReadSuccess
  | ScanPackageReadFailure;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Read a File object as text and return the string. */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

/** Parse JSON, returning null on any error (invalid JSON or non-object). */
function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * findFileByBasename — finds a file in a FileList whose basename (last path
 * segment) matches `name`, case-insensitively.
 *
 * `webkitdirectory` inputs prepend folder names to `file.name`, so we strip
 * to the basename before comparing.
 */
function findFileByBasename(files: FileList, name: string): File | null {
  const lower = name.toLowerCase();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const basename = file.name.split('/').pop()?.toLowerCase() ?? file.name.toLowerCase();
    if (basename === lower) return file;
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * readScanPackage — reads and parses an Atlas Scan export package from a
 * FileList.
 *
 * The caller is responsible for validating the parsed manifest and bundle
 * contents — this function only handles file I/O and JSON parsing.
 *
 * Usage:
 *   const result = await readScanPackage(fileInputElement.files!);
 *   if (!result.ok) { /* handle errors *\/ }
 *   // result.manifestRaw and result.bundleRaw are ready for validation
 */
export async function readScanPackage(files: FileList): Promise<ScanPackageReadResult> {
  const errors: string[] = [];

  // 1. Locate manifest.json
  const manifestFile = findFileByBasename(files, 'manifest.json');
  if (!manifestFile) {
    errors.push('manifest.json not found in the selected files');
  }

  // 2. Locate scan_bundle.json
  const bundleFile = findFileByBasename(files, 'scan_bundle.json');
  if (!bundleFile) {
    errors.push('scan_bundle.json not found in the selected files');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // 3. Read and parse both required files
  let manifestRaw: unknown;
  let bundleRaw: unknown;

  try {
    const manifestText = await readFileAsText(manifestFile!);
    manifestRaw = safeParseJson(manifestText);
    if (manifestRaw === null) {
      errors.push('manifest.json is not valid JSON');
    }
  } catch (err) {
    errors.push(`Could not read manifest.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const bundleText = await readFileAsText(bundleFile!);
    bundleRaw = safeParseJson(bundleText);
    if (bundleRaw === null) {
      errors.push('scan_bundle.json is not valid JSON');
    }
  } catch (err) {
    errors.push(`Could not read scan_bundle.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // 4. Detect evidence files — match filenames against all selected files
  const allBasenames = Array.from({ length: files.length }, (_, i) =>
    files[i].name.split('/').pop() ?? files[i].name,
  );
  const evidenceNames = allBasenames.filter(
    name => name !== 'manifest.json' && name !== 'scan_bundle.json',
  );

  return {
    ok: true,
    manifestRaw: manifestRaw!,
    bundleRaw: bundleRaw!,
    evidenceCount: evidenceNames.length,
    evidenceNames,
  };
}
