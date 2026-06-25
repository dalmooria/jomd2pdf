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

export const paginate = async ({ html, settings, previewEl, Paged, extraCss = '' }) => {
  previewEl.innerHTML = ''
  const source = document.createElement('template')
  source.innerHTML = html
  const css = buildPageRules(settings) + '\n' + extraCss
  const previewer = new Paged.Previewer()
  // paged.js는 author CSS를 stylesheets 인자로 받아야 @page·break 규칙을 적용한다.
  // []를 넘기면 규칙이 무시되고 기본값(US Letter, 분할 없음)이 쓰인다.
  await previewer.preview(source.content, [{ _: css }], previewEl)
}

export const print = () => window.print()
