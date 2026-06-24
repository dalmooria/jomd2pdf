const KEY = 'jomd2pdf:settings'

export const DEFAULT_SETTINGS = {
  paper: 'A4',
  orientation: 'portrait',
  marginMm: 20,
  bodyFont: 'Pretendard',
  bodySizePt: 11,
  lineHeight: 1.6,
  codeTheme: 'github',
  showPageNumber: true,
  showTitleHeader: false,
}

const PAPER = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
}

export const loadSettings = (storage) => {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export const saveSettings = (storage, settings) => {
  storage.setItem(KEY, JSON.stringify(settings))
}

export const pageDimensions = (settings) => {
  const p = PAPER[settings.paper] || PAPER.A4
  const [w, h] = settings.orientation === 'landscape'
    ? [p.height, p.width] : [p.width, p.height]
  return { width: `${w}mm`, height: `${h}mm` }
}

export const applySettings = (settings, root) => {
  const { width } = pageDimensions(settings)
  root.style.setProperty('--page-width', width)
  root.style.setProperty('--page-margin', `${settings.marginMm}mm`)
  root.style.setProperty('--body-font', `"${settings.bodyFont}", "Noto Sans KR", sans-serif`)
  root.style.setProperty('--body-size', `${settings.bodySizePt}pt`)
  root.style.setProperty('--line-height', String(settings.lineHeight))
}
