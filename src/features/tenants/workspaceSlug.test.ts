/**
 * src/features/tenants/workspaceSlug.test.ts
 *
 * Tests for workspace slug normalisation and validation.
 *
 * Coverage:
 *   - slug normalisation (whitespace, uppercase, underscores)
 *   - valid slugs pass isValidWorkspaceSlug
 *   - invalid slugs are rejected (too short, too long, bad chars, leading/trailing hyphens)
 *   - reserved slugs are rejected
 *   - assertValidWorkspaceSlug throws with a descriptive message
 */

import { describe, it, expect } from 'vitest';
import {
  normaliseWorkspaceSlug,
  isValidWorkspaceSlug,
  assertValidWorkspaceSlug,
} from './workspaceSlug';

// ─── normaliseWorkspaceSlug ───────────────────────────────────────────────────

describe('normaliseWorkspaceSlug', () => {
  it('lowercases input', () => {
    expect(normaliseWorkspaceSlug('BritishGas')).toBe('britishgas');
  });

  it('trims whitespace', () => {
    expect(normaliseWorkspaceSlug('  myslug  ')).toBe('myslug');
  });

  it('replaces spaces with hyphens', () => {
    expect(normaliseWorkspaceSlug('my company')).toBe('my-company');
  });

  it('replaces underscores with hyphens', () => {
    expect(normaliseWorkspaceSlug('my_company')).toBe('my-company');
  });

  it('collapses multiple hyphens into one', () => {
    expect(normaliseWorkspaceSlug('my---company')).toBe('my-company');
  });

  it('strips characters that are not letters, numbers, or hyphens', () => {
    expect(normaliseWorkspaceSlug('hello.world!')).toBe('helloworld');
  });

  it('strips leading and trailing hyphens', () => {
    expect(normaliseWorkspaceSlug('-myslug-')).toBe('myslug');
  });

  it('handles a mixed input', () => {
    expect(normaliseWorkspaceSlug('  My Company Ltd. ')).toBe('my-company-ltd');
  });
});

// ─── isValidWorkspaceSlug ────────────────────────────────────────────────────

describe('isValidWorkspaceSlug', () => {
  it('accepts a valid simple slug', () => {
    expect(isValidWorkspaceSlug('myslug')).toBe(true);
  });

  it('accepts a slug with hyphens', () => {
    expect(isValidWorkspaceSlug('demo-heating')).toBe(true);
  });

  it('accepts a slug with numbers', () => {
    expect(isValidWorkspaceSlug('heat123')).toBe(true);
  });

  it('accepts a slug at minimum length (3)', () => {
    expect(isValidWorkspaceSlug('abc')).toBe(true);
  });

  it('accepts a slug at maximum length (40)', () => {
    expect(isValidWorkspaceSlug('a'.repeat(40))).toBe(true);
  });

  it('rejects a slug that is too short (< 3)', () => {
    expect(isValidWorkspaceSlug('ab')).toBe(false);
  });

  it('rejects a slug that is too long (> 40)', () => {
    expect(isValidWorkspaceSlug('a'.repeat(41))).toBe(false);
  });

  it('rejects a slug with uppercase letters', () => {
    expect(isValidWorkspaceSlug('MySlug')).toBe(false);
  });

  it('rejects a slug with dots', () => {
    expect(isValidWorkspaceSlug('my.slug')).toBe(false);
  });

  it('rejects a slug with spaces', () => {
    expect(isValidWorkspaceSlug('my slug')).toBe(false);
  });

  it('rejects a slug with underscores', () => {
    expect(isValidWorkspaceSlug('my_slug')).toBe(false);
  });

  it('rejects a slug with a leading hyphen', () => {
    expect(isValidWorkspaceSlug('-myslug')).toBe(false);
  });

  it('rejects a slug with a trailing hyphen', () => {
    expect(isValidWorkspaceSlug('myslug-')).toBe(false);
  });

  it.each([
    'admin',
    'api',
    'app',
    'portal',
    'receive-scan',
    'www',
    'atlas-mind',
  ])('rejects reserved slug "%s"', (slug) => {
    expect(isValidWorkspaceSlug(slug)).toBe(false);
  });
});

// ─── assertValidWorkspaceSlug ────────────────────────────────────────────────

describe('assertValidWorkspaceSlug', () => {
  it('does not throw for a valid slug', () => {
    expect(() => assertValidWorkspaceSlug('britishgas')).not.toThrow();
  });

  it('throws for an empty string', () => {
    expect(() => assertValidWorkspaceSlug('')).toThrow();
  });

  it('throws for a slug that is too short', () => {
    expect(() => assertValidWorkspaceSlug('ab')).toThrow(/at least 3/i);
  });

  it('throws for a slug that is too long', () => {
    expect(() => assertValidWorkspaceSlug('a'.repeat(41))).toThrow(/no more than 40/i);
  });

  it('throws with a message about allowed characters for invalid chars', () => {
    expect(() => assertValidWorkspaceSlug('My Slug!')).toThrow(/lowercase letters/i);
  });

  it('throws mentioning the reserved slug by name', () => {
    expect(() => assertValidWorkspaceSlug('admin')).toThrow(/reserved/i);
  });

  it('throws for a leading hyphen', () => {
    expect(() => assertValidWorkspaceSlug('-bad')).toThrow();
  });
});
