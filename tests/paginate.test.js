import { describe, it, expect } from 'vitest'
import { buildPageRules } from '../src/paginate.js'
import { DEFAULT_SETTINGS } from '../src/settings.js'

describe('buildPageRules', () => {
  it('sets size and margin from settings', () => {
    const css = buildPageRules({ ...DEFAULT_SETTINGS, paper: 'A4', marginMm: 25 })
    expect(css).toContain('size: 210mm 297mm')
    expect(css).toContain('margin: 25mm')
  })
  it('adds page number when enabled', () => {
    const css = buildPageRules({ ...DEFAULT_SETTINGS, showPageNumber: true })
    expect(css).toContain('@bottom-center')
    expect(css).toContain('counter(page)')
  })
  it('omits page number when disabled', () => {
    const css = buildPageRules({ ...DEFAULT_SETTINGS, showPageNumber: false })
    expect(css).not.toContain('@bottom-center')
  })
})
