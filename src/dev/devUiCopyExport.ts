/**
 * devUiCopyExport.ts
 *
 * Helpers for generating copy-box output from the UI Inventory.
 * Supports three output formats: plain text, Markdown checklist, and JSON.
 */

import type { DevUiRegistryItem } from './devUiRegistry';
import { isEligibleForCopyBox } from './devUiFilters';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CopyFormat = 'text' | 'markdown' | 'json';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveRouteDisplay(item: DevUiRegistryItem): string {
  if (item.fullRouteExample != null) return item.fullRouteExample;
  if (item.queryFlags != null && item.queryFlags.length > 0) {
    return '/?' + item.queryFlags.join('&');
  }
  if (item.routePath != null) return item.routePath;
  return 'unresolved';
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatAsText(items: DevUiRegistryItem[]): string {
  return items
    .map(item => {
      const route = resolveRouteDisplay(item);
      const lines = [
        item.copyLabel ?? item.commonName,
        `  code: ${item.codeName}`,
        `  file: ${item.filePath}`,
        `  route: ${route}`,
        `  access: ${item.access ?? 'unknown'}`,
        `  status: ${item.status}`,
      ];
      if (item.parentCodeName != null) lines.push(`  parent: ${item.parentCodeName}`);
      if (item.childElementIds != null && item.childElementIds.length > 0) {
        lines.push(`  contains: ${item.childElementIds.join(', ')}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatAsMarkdown(items: DevUiRegistryItem[]): string {
  return items
    .map(item => {
      const route = resolveRouteDisplay(item);
      const lines = [
        `- [ ] **${item.copyLabel ?? item.commonName}**`,
        `  - code: \`${item.codeName}\``,
        `  - file: \`${item.filePath}\``,
        `  - route: \`${route}\``,
        `  - access: \`${item.access ?? 'unknown'}\``,
        `  - status: \`${item.status}\``,
      ];
      if (item.parentCodeName != null) lines.push(`  - parent: \`${item.parentCodeName}\``);
      if (item.childElementIds != null && item.childElementIds.length > 0) {
        lines.push(`  - contains: ${item.childElementIds.map(c => `\`${c}\``).join(', ')}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatAsJson(items: DevUiRegistryItem[]): string {
  const payload = items.map(item => ({
    name: item.copyLabel ?? item.commonName,
    codeName: item.codeName,
    file: item.filePath,
    route: resolveRouteDisplay(item),
    routeKind: item.routeKind ?? 'unknown',
    queryFlags: item.queryFlags ?? [],
    access: item.access ?? 'unknown',
    status: item.status,
    category: item.category,
    parentCodeName: item.parentCodeName ?? null,
    childElementIds: item.childElementIds ?? [],
    sourceFiles: item.sourceFiles ?? [],
  }));
  return JSON.stringify(payload, null, 2);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Formats a single registry item as plain text (same schema as the copy-box
 * plain-text output). Useful for per-card copy buttons.
 */
export function formatSingleItemAsText(item: DevUiRegistryItem): string {
  const route = resolveRouteDisplay(item);
  const lines = [
    item.copyLabel ?? item.commonName,
    `  code: ${item.codeName}`,
    `  file: ${item.filePath}`,
    `  route: ${route}`,
    `  access: ${item.access ?? 'unknown'}`,
    `  status: ${item.status}`,
  ];
  if (item.parentCodeName != null) lines.push(`  parent: ${item.parentCodeName}`);
  if (item.childElementIds != null && item.childElementIds.length > 0) {
    lines.push(`  contains: ${item.childElementIds.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Generates the copy-box output string from a filtered list of registry items.
 *
 * @param items   Already-filtered list (apply your copy-box filters first).
 * @param format  Output format: 'text' | 'markdown' | 'json'.
 */
export function generateCopyBoxOutput(
  items: DevUiRegistryItem[],
  format: CopyFormat,
): string {
  const eligible = items.filter(isEligibleForCopyBox);
  if (eligible.length === 0) {
    switch (format) {
      case 'json':
        return '[]';
      case 'markdown':
        return '_No items match the current filters._';
      default:
        return 'No items match the current filters.';
    }
  }

  switch (format) {
    case 'markdown':
      return formatAsMarkdown(eligible);
    case 'json':
      return formatAsJson(eligible);
    default:
      return formatAsText(eligible);
  }
}

/**
 * Returns a subset of items that are eligible for the copy box
 * (includeInCopyBox=true OR status=canonical OR access=production).
 */
export function getCopyBoxItems(items: DevUiRegistryItem[]): DevUiRegistryItem[] {
  return items.filter(isEligibleForCopyBox);
}
