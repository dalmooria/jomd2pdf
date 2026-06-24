import { describe, it, expect } from 'vitest'
import {
  isMarkdown, isImage, normalizeKey, dirname, joinPath,
  buildRegistry, resolveImagePath, groupByFolder,
} from '../src/files.js'

describe('classification', () => {
  it('detects markdown', () => {
    expect(isMarkdown('a.md')).toBe(true)
    expect(isMarkdown('A.MD')).toBe(true)
    expect(isMarkdown('a.markdown')).toBe(true)
    expect(isMarkdown('a.txt')).toBe(false)
  })
  it('detects images', () => {
    expect(isImage('p.png')).toBe(true)
    expect(isImage('p.JPG')).toBe(true)
    expect(isImage('p.svg')).toBe(true)
    expect(isImage('p.md')).toBe(false)
  })
})

describe('path helpers', () => {
  it('normalizes keys', () => {
    expect(normalizeKey('./a/b.md')).toBe('a/b.md')
    expect(normalizeKey('a\\b.md')).toBe('a/b.md')
  })
  it('dirname', () => {
    expect(dirname('a/b/c.md')).toBe('a/b')
    expect(dirname('c.md')).toBe('')
  })
  it('joins and resolves .. and .', () => {
    expect(joinPath('a/b', './img.png')).toBe('a/b/img.png')
    expect(joinPath('a/b', '../img.png')).toBe('a/img.png')
    expect(joinPath('', 'img.png')).toBe('img.png')
  })
})

describe('buildRegistry', () => {
  it('splits md and images by relative path key', () => {
    const f = (n) => new File(['x'], n)
    const entries = [
      { path: '교육학/1강.md', file: f('1강.md') },
      { path: '교육학/img/d.png', file: f('d.png') },
      { path: '전공/1강.md', file: f('1강.md') },
      { path: 'readme.txt', file: f('readme.txt') },
    ]
    const reg = buildRegistry(entries)
    expect(reg.mdFiles.map(m => m.key)).toEqual(['교육학/1강.md', '전공/1강.md'])
    expect(reg.images.has('교육학/img/d.png')).toBe(true)
    expect(reg.images.size).toBe(1)
  })
})

describe('resolveImagePath', () => {
  const f = (n) => new File(['x'], n)
  const images = new Map([
    ['교육학/img/d.png', f('d.png')],
    ['전공/p.png', f('p.png')],
  ])
  it('resolves relative path against md baseDir', () => {
    expect(resolveImagePath('./img/d.png', '교육학', images)).toBe(images.get('교육학/img/d.png'))
    expect(resolveImagePath('img/d.png', '교육학', images)).toBe(images.get('교육학/img/d.png'))
  })
  it('falls back to basename match', () => {
    expect(resolveImagePath('weird/path/p.png', '없는폴더', images)).toBe(images.get('전공/p.png'))
  })
  it('returns null for http urls', () => {
    expect(resolveImagePath('https://x/y.png', '교육학', images)).toBe(null)
  })
  it('returns null when nothing matches', () => {
    expect(resolveImagePath('nope.png', '교육학', images)).toBe(null)
  })
})

describe('groupByFolder', () => {
  const f = (n) => new File(['x'], n)
  it('groups md files by directory, sorted', () => {
    const mdFiles = [
      { key: '전공/1강.md', name: '1강.md', file: f('1강.md') },
      { key: '교육학/2강.md', name: '2강.md', file: f('2강.md') },
      { key: '교육학/1강.md', name: '1강.md', file: f('1강.md') },
      { key: 'intro.md', name: 'intro.md', file: f('intro.md') },
    ]
    const groups = groupByFolder(mdFiles)
    expect(groups.map(g => g.folder)).toEqual(['', '교육학', '전공'])
    expect(groups[1].items.map(i => i.key)).toEqual(['교육학/2강.md', '교육학/1강.md'])
  })
})
