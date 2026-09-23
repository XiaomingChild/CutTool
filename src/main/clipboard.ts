import { clipboard, nativeImage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { appendClip, getConfig, getImagesDir, Clip } from './store'

let lastFingerprint = ''

// 开始轮询剪贴板，内容变化时回调通知前端
export function startClipboardWatcher(onClip: () => void) {
  setInterval(() => {
    try {
      pollOnce(onClip)
    } catch {
      // 其他软件短暂占用剪贴板时等待下一轮读取
    }
  }, 500)
}

// 单次轮询：区分文本与图片
function pollOnce(onClip: () => void) {
  const config = getConfig()
  const formats = clipboard.availableFormats()

  // 图片优先：剪贴板当前是图片且开启了监听
  if (config.listenImage && formats.some((f) => f.startsWith('image') || f === 'PNG')) {
    const image = clipboard.readImage()
    if (!image.isEmpty()) {
      const buffer = image.toPNG()
      // 相邻去重：哈希首段字节 + 长度作为指纹
      const fingerprint = createImageFingerprint(buffer)
      if (fingerprint === lastFingerprint) return
      lastFingerprint = fingerprint

      // 图片以独立文件落盘，记录里只存文件名
      const id = Date.now()
      const file = `${id}.png`
      fs.writeFileSync(path.join(getImagesDir(), file), buffer)
      appendClip({ id, type: 'image', content: file, createdAt: id })
      onClip()
      return
    }
  }

  // 文本
  const text = clipboard.readText()
  if (!text) return
  const fingerprint = 'text|' + text
  if (fingerprint === lastFingerprint) return
  lastFingerprint = fingerprint
  appendClip({ id: Date.now(), type: 'text', content: text, createdAt: Date.now() })
  onClip()
}

// 把一条历史记录写回系统剪贴板
export function copyClip(clip: Clip): boolean {
  if (clip.type === 'image') {
    const image = nativeImage.createFromPath(path.join(getImagesDir(), clip.content))
    if (image.isEmpty()) return false
    clipboard.writeImage(image)
    lastFingerprint = createImageFingerprint(image.toPNG())
  } else {
    clipboard.writeText(clip.content)
    lastFingerprint = 'text|' + clip.content
  }
  return true
}

// 根据图片数据生成用于相邻去重的轻量指纹
function createImageFingerprint(buffer: Buffer): string {
  const head = buffer.subarray(0, 65536).toString('base64')
  return 'image|' + buffer.length + '|' + simpleHash(head)
}

// 简单字符串哈希，用于图片相邻去重
function simpleHash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0
  }
  return h.toString(36)
}
