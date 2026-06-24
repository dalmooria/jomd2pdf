import { buildRegistry, dirname, groupByFolder } from './src/files.js'
import { loadSettings, saveSettings, applySettings, DEFAULT_SETTINGS } from './src/settings.js'
import { createRenderer, rewriteImageSources, renderMermaid } from './src/render.js'
import { paginate, print } from './src/paginate.js'

const Paged = window.Paged || { Previewer: window.PagedPolyfill?.Previewer }
window.mermaid?.initialize({ startOnLoad: false, securityLevel: 'strict' })

const renderer = createRenderer({
  markdownit: window.markdownit,
  texmath: window.texmath,
  katex: window.katex,
  hljs: window.hljs,
  DOMPurify: window.DOMPurify,
  taskLists: window.markdownitTaskLists,
  footnote: window.markdownitFootnote,
})

const state = {
  registry: { mdFiles: [], images: new Map() },
  selectedKey: null,
  settings: loadSettings(localStorage),
  objectUrls: [],
}

const els = {
  fileList: document.getElementById('file-list'),
  preview: document.getElementById('preview'),
  settingsPanel: document.getElementById('settings-panel'),
}

applySettings(state.settings, document.documentElement)

// --- 파일 등록 ---
// {path, file}[] 를 받아 누적 병합(키 중복 시 신규로 교체)
const mergeEntries = (entries) => {
  const reg = buildRegistry(entries)
  const mdMap = new Map(state.registry.mdFiles.map(m => [m.key, m]))
  for (const m of reg.mdFiles) mdMap.set(m.key, m)
  state.registry.mdFiles = [...mdMap.values()]
  for (const [k, v] of reg.images) state.registry.images.set(k, v)
  renderFileList()
}

const addEntries = (fileList) => mergeEntries(
  Array.from(fileList).map(f => ({ path: f.webkitRelativePath || f.name, file: f }))
)

document.getElementById('pick-folder').onclick = () =>
  document.getElementById('folder-input').click()
document.getElementById('pick-files').onclick = () =>
  document.getElementById('file-input').click()
document.getElementById('folder-input').onchange = (e) => addEntries(e.target.files)
document.getElementById('file-input').onchange = (e) => addEntries(e.target.files)

// --- 폴더/파일 드래그앤드롭 (DataTransfer entries 재귀) ---
const readEntry = (entry, prefix = '') => new Promise((resolve) => {
  if (entry.isFile) {
    entry.file((file) => resolve([{ path: prefix + file.name, file }]))
  } else if (entry.isDirectory) {
    const reader = entry.createReader()
    const collected = []
    const readBatch = () => reader.readEntries(async (batch) => {
      if (!batch.length) {
        const nested = await Promise.all(collected.map(e => readEntry(e, prefix + entry.name + '/')))
        resolve(nested.flat())
      } else { collected.push(...batch); readBatch() }
    })
    readBatch()
  } else resolve([])
})

const dropTarget = document.getElementById('layout')
dropTarget.addEventListener('dragover', (e) => { e.preventDefault(); dropTarget.classList.add('drag-over') })
dropTarget.addEventListener('dragleave', () => dropTarget.classList.remove('drag-over'))
dropTarget.addEventListener('drop', async (e) => {
  e.preventDefault()
  dropTarget.classList.remove('drag-over')
  const roots = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry?.()).filter(Boolean)
  const nested = await Promise.all(roots.map(entry => readEntry(entry)))
  mergeEntries(nested.flat())
})

// --- 파일 목록 (폴더 그룹/들여쓰기 + 개별 삭제 + 전체 비우기) ---
const removeFile = (key) => {
  state.registry.mdFiles = state.registry.mdFiles.filter(m => m.key !== key)
  if (state.selectedKey === key) {
    state.selectedKey = null
    cleanupUrls()
    els.preview.innerHTML = ''
  }
  renderFileList()
}

const clearAll = () => {
  state.registry = { mdFiles: [], images: new Map() }
  state.selectedKey = null
  cleanupUrls()
  els.preview.innerHTML = ''
  renderFileList()
}

const renderFileList = () => {
  els.fileList.innerHTML = ''
  if (state.registry.mdFiles.length === 0) {
    els.fileList.innerHTML = '<div class="empty-hint">폴더나 파일을 등록하세요</div>'
    return
  }
  // 헤더: 전체 비우기
  const header = document.createElement('div')
  header.className = 'list-header'
  header.innerHTML = `<span>${state.registry.mdFiles.length}개</span><button id="clear-all">전체 비우기</button>`
  els.fileList.appendChild(header)
  header.querySelector('#clear-all').onclick = clearAll

  for (const group of groupByFolder(state.registry.mdFiles)) {
    if (group.folder) {
      const g = document.createElement('div')
      g.className = 'folder-group'
      g.textContent = `📁 ${group.folder}`
      els.fileList.appendChild(g)
    }
    for (const m of group.items) {
      const item = document.createElement('div')
      item.className = 'file-item' + (m.key === state.selectedKey ? ' selected' : '')
      if (group.folder) item.classList.add('indented')
      const span = document.createElement('span')
      span.className = 'fname'
      span.textContent = (m.key === state.selectedKey ? '✓ ' : '') + m.name
      span.onclick = () => selectFile(m.key)
      const btn = document.createElement('button')
      btn.className = 'del'
      btn.title = '삭제'
      btn.textContent = '✕'
      btn.onclick = (e) => { e.stopPropagation(); removeFile(m.key) }
      item.appendChild(span)
      item.appendChild(btn)
      els.fileList.appendChild(item)
    }
  }
}

// --- 미리보기 ---
const cleanupUrls = () => {
  state.objectUrls.forEach(u => URL.revokeObjectURL(u))
  state.objectUrls = []
}

const selectFile = async (key) => {
  state.selectedKey = key
  renderFileList()
  const md = state.registry.mdFiles.find(m => m.key === key)
  if (!md) return
  const text = await md.file.text()

  cleanupUrls()
  if (!text.trim()) {
    els.preview.innerHTML = '<p class="empty-doc">내용이 없는 문서입니다.</p>'
    return
  }
  const html = renderer.renderMarkdown(text)
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  rewriteImageSources(tmp, dirname(key), state.registry.images, state.objectUrls)
  await renderMermaid(tmp, window.mermaid)
  await document.fonts.ready
  await paginate({ html: tmp.innerHTML, settings: state.settings, previewEl: els.preview, Paged })
}

// --- 설정 패널 ---
let debounceTimer
const onSettingsChange = (patch) => {
  state.settings = { ...state.settings, ...patch }
  saveSettings(localStorage, state.settings)
  applySettings(state.settings, document.documentElement)
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { if (state.selectedKey) selectFile(state.selectedKey) }, 300)
}

const field = (label, inner) => `<label class="field">${label}${inner}</label>`
const renderSettingsPanel = () => {
  const s = state.settings
  els.settingsPanel.innerHTML = `
    <div class="settings-group"><div class="group-title">① 페이지</div>
      ${field('용지', `<select data-k="paper"><option ${s.paper==='A4'?'selected':''}>A4</option><option ${s.paper==='Letter'?'selected':''}>Letter</option></select>`)}
      ${field('방향', `<select data-k="orientation"><option value="portrait" ${s.orientation==='portrait'?'selected':''}>세로</option><option value="landscape" ${s.orientation==='landscape'?'selected':''}>가로</option></select>`)}
      ${field('여백(mm)', `<input type="number" data-k="marginMm" value="${s.marginMm}" min="0" max="50">`)}
    </div>
    <div class="settings-group"><div class="group-title">② 글꼴/본문</div>
      ${field('폰트', `<input data-k="bodyFont" value="${s.bodyFont}">`)}
      ${field('크기(pt)', `<input type="number" data-k="bodySizePt" value="${s.bodySizePt}" min="6" max="24">`)}
      ${field('줄간격', `<input type="number" step="0.1" data-k="lineHeight" value="${s.lineHeight}" min="1" max="3">`)}
    </div>
    <div class="settings-group"><div class="group-title">③ 코드</div>
      ${field('테마', `<select data-k="codeTheme"><option value="github" ${s.codeTheme==='github'?'selected':''}>GitHub Light</option><option value="github-dark" ${s.codeTheme==='github-dark'?'selected':''}>GitHub Dark</option><option value="atom-one-light" ${s.codeTheme==='atom-one-light'?'selected':''}>Atom One Light</option></select>`)}
    </div>
    <div class="settings-group"><div class="group-title">④ 머리말/번호</div>
      ${field('', `<input type="checkbox" data-k="showPageNumber" ${s.showPageNumber?'checked':''}> 페이지 번호`)}
      ${field('', `<input type="checkbox" data-k="showTitleHeader" ${s.showTitleHeader?'checked':''}> 제목 머리말`)}
    </div>
    <button id="reset-settings">기본값으로</button>`

  els.settingsPanel.querySelectorAll('[data-k]').forEach(el => {
    el.onchange = () => {
      const k = el.dataset.k
      let v
      if (el.type === 'checkbox') v = el.checked
      else if (el.type === 'number') { const n = parseFloat(el.value); v = Number.isFinite(n) ? n : DEFAULT_SETTINGS[k] }
      else v = el.value
      if (k === 'codeTheme') applyCodeTheme(v)
      onSettingsChange({ [k]: v })
    }
  })
  els.settingsPanel.querySelector('#reset-settings').onclick = () => {
    clearTimeout(debounceTimer)
    state.settings = { ...DEFAULT_SETTINGS }
    saveSettings(localStorage, state.settings)
    applyCodeTheme(state.settings.codeTheme)
    applySettings(state.settings, document.documentElement)
    renderSettingsPanel()
    if (state.selectedKey) selectFile(state.selectedKey)
  }
}

const applyCodeTheme = (theme) => {
  document.getElementById('hljs-theme').href =
    `https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/styles/${theme}.min.css`
}

document.getElementById('toggle-settings').onclick = () => {
  els.settingsPanel.hidden = !els.settingsPanel.hidden
}
document.getElementById('print-btn').onclick = () => print()

// 비-Chromium 경고
if (!/Chrome|Edg/.test(navigator.userAgent)) {
  document.getElementById('browser-warning').hidden = false
}

applyCodeTheme(state.settings.codeTheme)
renderSettingsPanel()
