import { resolveImagePath } from './files.js'

export const createRenderer = (deps) => {
  const { markdownit, texmath, katex, hljs, DOMPurify, taskLists, footnote } = deps

  const md = markdownit({
    html: true,
    linkify: true,
    highlight: (code, lang) => {
      if (lang === 'mermaid') {
        // 코드 그대로 두고 mermaid 단계에서 처리
        return `<pre class="mermaid-src"><code class="language-mermaid">${md.utils.escapeHtml(code)}</code></pre>`
      }
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre><code class="hljs language-${lang}">${hljs.highlight(code, { language: lang }).value}</code></pre>`
        } catch {}
      }
      return `<pre><code class="hljs">${md.utils.escapeHtml(code)}</code></pre>`
    },
  })
  md.use(texmath, { engine: katex, delimiters: 'dollars' })
  md.use(taskLists, { label: true })
  md.use(footnote)

  const renderMarkdown = (text) => {
    const raw = md.render(text)
    return DOMPurify.sanitize(raw, { ADD_TAGS: ['foreignObject'] })
  }

  return { renderMarkdown }
}

export const rewriteImageSources = (container, baseDir, images, objectUrls) => {
  for (const img of container.querySelectorAll('img')) {
    const src = img.getAttribute('src') || ''
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('data:')) continue
    const file = resolveImagePath(src, baseDir, images)
    if (file) {
      const url = URL.createObjectURL(file)
      objectUrls.push(url)
      img.setAttribute('src', url)
    } else {
      img.setAttribute('data-missing', 'true')
      img.removeAttribute('src')
      img.setAttribute('alt', `(이미지 없음: ${src})`)
    }
  }
}

export const renderMermaid = async (container, mermaid) => {
  const blocks = container.querySelectorAll('code.language-mermaid')
  let i = 0
  for (const code of blocks) {
    const pre = code.closest('pre')
    const def = code.textContent
    try {
      const { svg } = await mermaid.render(`mmd-${i++}`, def)
      const wrap = document.createElement('div')
      wrap.className = 'mermaid-rendered'
      wrap.innerHTML = svg
      pre.replaceWith(wrap)
    } catch (e) {
      const err = document.createElement('div')
      err.className = 'mermaid-error'
      err.textContent = `Mermaid 오류: ${e.message || e}`
      pre.replaceWith(err)
    }
  }
}
