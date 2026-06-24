import { pageDimensions } from './settings.js'

export const buildPageRules = (settings) => {
  const { width, height } = pageDimensions(settings)
  const pageNum = settings.showPageNumber
    ? `@bottom-center { content: counter(page); font-size: 9pt; color: #666; }`
    : ''
  const header = settings.showTitleHeader
    ? `@top-center { content: string(doctitle); font-size: 9pt; color: #888; }`
    : ''
  return `
@page {
  size: ${width} ${height};
  margin: ${settings.marginMm}mm;
  ${pageNum}
  ${header}
}`
}

export const paginate = async ({ html, settings, previewEl, Paged }) => {
  // 동적 @page 규칙 주입(교체)
  let styleEl = document.getElementById('paged-page-rules')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'paged-page-rules'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = buildPageRules(settings)

  previewEl.innerHTML = ''
  const source = document.createElement('template')
  source.innerHTML = html
  const previewer = new Paged.Previewer()
  await previewer.preview(source.content, [], previewEl)
}

export const print = () => window.print()
