// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_SETTINGS, loadSettings, saveSettings, pageDimensions, applySettings,
} from '../src/settings.js'

const fakeStorage = () => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
  }
}

describe('settings persistence', () => {
  let storage
  beforeEach(() => { storage = fakeStorage() })

  it('returns defaults when storage empty', () => {
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })
  it('merges saved over defaults', () => {
    saveSettings(storage, { ...DEFAULT_SETTINGS, marginMm: 30 })
    expect(loadSettings(storage).marginMm).toBe(30)
    expect(loadSettings(storage).paper).toBe(DEFAULT_SETTINGS.paper)
  })
  it('ignores corrupt storage', () => {
    storage.setItem('jomd2pdf:settings', '{not json')
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })
})

describe('pageDimensions', () => {
  it('A4 portrait', () => {
    expect(pageDimensions({ ...DEFAULT_SETTINGS, paper: 'A4', orientation: 'portrait' }))
      .toEqual({ width: '210mm', height: '297mm' })
  })
  it('A4 landscape swaps', () => {
    expect(pageDimensions({ ...DEFAULT_SETTINGS, paper: 'A4', orientation: 'landscape' }))
      .toEqual({ width: '297mm', height: '210mm' })
  })
  it('Letter portrait', () => {
    expect(pageDimensions({ ...DEFAULT_SETTINGS, paper: 'Letter', orientation: 'portrait' }))
      .toEqual({ width: '215.9mm', height: '279.4mm' })
  })
})

describe('applySettings', () => {
  it('writes CSS variables to root', () => {
    const root = document.documentElement
    applySettings({ ...DEFAULT_SETTINGS, marginMm: 25, bodySizePt: 12 }, root)
    expect(root.style.getPropertyValue('--page-margin')).toBe('25mm')
    expect(root.style.getPropertyValue('--body-size')).toBe('12pt')
  })
})
