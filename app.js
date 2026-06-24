// 진입점: 이후 Task에서 모듈을 배선한다.
console.log('jomd2pdf loaded', {
  hasMarkdownit: typeof window.markdownit,
  hasMermaid: typeof window.mermaid,
  hasPaged: typeof window.PagedPolyfill,
})
