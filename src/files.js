const MD_EXT = /\.(md|markdown)$/i
const IMG_EXT = /\.(png|jpe?g|gif|svg|webp|bmp)$/i

export const isMarkdown = (name) => MD_EXT.test(name)
export const isImage = (name) => IMG_EXT.test(name)

export const normalizeKey = (path) =>
  path.replace(/\\/g, '/').replace(/^\.\//, '')

export const dirname = (key) => {
  const i = key.lastIndexOf('/')
  return i === -1 ? '' : key.slice(0, i)
}

const basename = (key) => key.slice(key.lastIndexOf('/') + 1)

export const joinPath = (dir, rel) => {
  const parts = (dir ? dir.split('/') : []).concat(rel.split('/'))
  const out = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') out.pop()
    else out.push(p)
  }
  return out.join('/')
}

export const buildRegistry = (entries) => {
  const mdFiles = []
  const images = new Map()
  for (const { path, file } of entries) {
    const key = normalizeKey(path)
    if (isMarkdown(key)) mdFiles.push({ key, name: basename(key), file })
    else if (isImage(key)) images.set(key, file)
  }
  return { mdFiles, images }
}

export const resolveImagePath = (src, baseDir, images) => {
  if (/^[a-z]+:\/\//i.test(src) || src.startsWith('data:')) return null
  const full = joinPath(baseDir, normalizeKey(src))
  if (images.has(full)) return images.get(full)
  const base = basename(normalizeKey(src))
  for (const [key, file] of images) {
    if (basename(key) === base) return file
  }
  return null
}

export const groupByFolder = (mdFiles) => {
  const map = new Map()
  for (const m of mdFiles) {
    const folder = dirname(m.key)
    if (!map.has(folder)) map.set(folder, [])
    map.get(folder).push(m)
  }
  return [...map.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((folder) => ({ folder, items: map.get(folder) }))
}
