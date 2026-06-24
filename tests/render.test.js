// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import markdownit from 'markdown-it'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import hljs from 'highlight.js'
import createDOMPurify from 'dompurify'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import { createRenderer, rewriteImageSources } from '../src/render.js'

const DOMPurify = createDOMPurify(new JSDOM('').window)
const renderer = createRenderer({ markdownit, texmath, katex, hljs, DOMPurify, taskLists, footnote })

describe('renderMarkdown', () => {
  it('renders headings and GFM tables', () => {
    const html = renderer.renderMarkdown('# 제목\n\n| a | b |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<h1>제목</h1>')
    expect(html).toContain('<table>')
  })
  it('renders inline math via KaTeX (not mangled by markdown)', () => {
    const html = renderer.renderMarkdown('식 $a_i = b_j$ 끝')
    expect(html).toContain('katex')
    expect(html).not.toContain('<em>') // _i_ 가 기울임으로 안 바뀜
  })
  it('strips dangerous html', () => {
    const html = renderer.renderMarkdown('<img src=x onerror=alert(1)>\n\n텍스트')
    expect(html).not.toContain('onerror')
  })
  it('renders GFM task list checkboxes', () => {
    const html = renderer.renderMarkdown('- [ ] 미완료\n- [x] 완료')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
  })
  it('renders footnotes', () => {
    const html = renderer.renderMarkdown('본문[^1]\n\n[^1]: 각주 내용')
    expect(html).toContain('footnote')
  })
})

describe('rewriteImageSources', () => {
  it('replaces relative img src with object url and tracks for cleanup', () => {
    const created = []
    globalThis.URL.createObjectURL = () => 'blob:fake-123'
    const div = document.createElement('div')
    div.innerHTML = '<img src="./img/d.png">'
    const images = new Map([['교육학/img/d.png', new File(['x'], 'd.png')]])
    const urls = []
    rewriteImageSources(div, '교육학', images, urls)
    expect(div.querySelector('img').getAttribute('src')).toBe('blob:fake-123')
    expect(urls).toEqual(['blob:fake-123'])
  })
  it('marks missing images', () => {
    const div = document.createElement('div')
    div.innerHTML = '<img src="./nope.png">'
    const urls = []
    rewriteImageSources(div, '교육학', new Map(), urls)
    expect(div.querySelector('img').getAttribute('data-missing')).toBe('true')
  })
  it('leaves http src untouched', () => {
    const div = document.createElement('div')
    div.innerHTML = '<img src="https://x/y.png">'
    const urls = []
    rewriteImageSources(div, '교육학', new Map(), urls)
    expect(div.querySelector('img').getAttribute('src')).toBe('https://x/y.png')
  })
})
