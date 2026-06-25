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
  batchPanel: document.getElementById('batch-panel'),
}

// 인쇄→PDF 저장 시 브라우저는 document.title을 기본 파일명으로 제안한다.
// 파일 선택 시 문서명(확장자 제외)으로 바꿔 "파일명.pdf"로 저장되게 하고, 선택 해제 시 앱 제목 복원.
const APP_TITLE = document.title
const docTitle = (name) => name.replace(/\.(md|markdown)$/i, '')

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
    document.title = APP_TITLE
  }
  renderFileList()
}

const clearAll = () => {
  state.registry = { mdFiles: [], images: new Map() }
  state.selectedKey = null
  cleanupUrls()
  els.preview.innerHTML = ''
  document.title = APP_TITLE
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

// md 한 개 → 렌더된 컨테이너(div). 이미지 경로까지 치환.
// mermaid는 호출부에서 처리(합본 시 합친 뒤 일괄 렌더 → 문서 간 id 충돌 방지).
const renderDoc = async (md) => {
  const text = await md.file.text()
  const div = document.createElement('div')
  if (!text.trim()) {
    div.innerHTML = '<p class="empty-doc">내용이 없는 문서입니다.</p>'
    return div
  }
  div.innerHTML = renderer.renderMarkdown(text)
  rewriteImageSources(div, dirname(md.key), state.registry.images, state.objectUrls)
  return div
}

const selectFile = async (key) => {
  state.selectedKey = key
  renderFileList()
  const md = state.registry.mdFiles.find(m => m.key === key)
  if (!md) return
  document.title = docTitle(md.name)
  cleanupUrls()
  const div = await renderDoc(md)
  await renderMermaid(div, window.mermaid)
  await document.fonts.ready
  await paginate({ html: div.innerHTML, settings: state.settings, previewEl: els.preview, Paged })
}

// --- 일괄 PDF ---
// 전체 합본: 문서마다 section으로 감싸 이어붙이고(섹션 경계 = 페이지 분할), mermaid는 합친 뒤 일괄 렌더.
const printMerged = async (mds, { titleHeader }) => {
  if (!mds.length) return
  cleanupUrls()
  state.selectedKey = null
  renderFileList()
  const wrap = document.createElement('div')
  for (const [i, md] of mds.entries()) {
    const sec = document.createElement('section')
    sec.className = 'doc-section'
    if (i > 0) sec.classList.add('doc-pagebreak') // 둘째 문서부터 새 페이지에서 시작
    if (titleHeader) {
      const h = document.createElement('h1')
      h.className = 'doc-title'
      h.textContent = md.name
      sec.appendChild(h)
    }
    const div = await renderDoc(md)
    while (div.firstChild) sec.appendChild(div.firstChild)
    wrap.appendChild(sec)
  }
  await renderMermaid(wrap, window.mermaid)
  await document.fonts.ready
  await paginate({
    html: wrap.innerHTML, settings: state.settings, previewEl: els.preview, Paged,
    extraCss: '.doc-pagebreak { break-before: page; }',
  })
  print()
}

// 문서별 개별: 한 문서씩 렌더→인쇄, afterprint로 다음 문서까지 대기.
// document.title을 파일명으로 바꿔 저장 대화상자의 파일명을 자동 제안.
const printEach = async (mds) => {
  if (!mds.length) return
  const prevTitle = document.title
  for (const md of mds) {
    cleanupUrls()
    state.selectedKey = md.key
    renderFileList()
    const div = await renderDoc(md)
    await renderMermaid(div, window.mermaid)
    await document.fonts.ready
    await paginate({ html: div.innerHTML, settings: state.settings, previewEl: els.preview, Paged })
    document.title = docTitle(md.name)
    await new Promise((resolve) => {
      const done = () => { window.removeEventListener('afterprint', done); resolve() }
      window.addEventListener('afterprint', done, { once: true })
      print()
    })
  }
  document.title = prevTitle
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

// --- 일괄 PDF 패널 ---
const renderBatchPanel = () => {
  const n = state.registry.mdFiles.length
  els.batchPanel.innerHTML = `
    <div class="group-title">일괄 PDF — 전체 ${n}개 문서</div>
    <label class="field"><input type="checkbox" id="batch-title" checked> 파일명 제목 머리말 넣기</label>
    <button id="batch-merged">📄 전체 합쳐 1개 PDF</button>
    <button id="batch-each">🗂 문서별 개별 PDF</button>
    <p class="batch-hint">· 합본: 문서 사이에 페이지를 나눠 PDF 하나로 인쇄(1회).<br>· 개별: 문서마다 저장 대화상자가 한 번씩 뜹니다(파일명 자동 제안).</p>`
  const opts = () => ({ titleHeader: els.batchPanel.querySelector('#batch-title').checked })
  els.batchPanel.querySelector('#batch-merged').onclick = () => {
    els.batchPanel.hidden = true
    printMerged(state.registry.mdFiles, opts())
  }
  els.batchPanel.querySelector('#batch-each').onclick = () => {
    els.batchPanel.hidden = true
    printEach(state.registry.mdFiles)
  }
}

document.getElementById('toggle-batch').onclick = () => {
  if (els.batchPanel.hidden) renderBatchPanel()
  els.batchPanel.hidden = !els.batchPanel.hidden
}

// 비-Chromium 경고
if (!/Chrome|Edg/.test(navigator.userAgent)) {
  document.getElementById('browser-warning').hidden = false
}

applyCodeTheme(state.settings.codeTheme)
renderSettingsPanel()
