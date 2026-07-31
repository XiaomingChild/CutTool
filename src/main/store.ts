import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// 单条剪贴记录
export interface Clip {
  id: number
  type: 'text' | 'image'
  content: string // 文本为原文；图片为文件名（相对 images 目录）
  createdAt: number
}

// 应用配置
export interface Settings {
  listenImage: boolean
  autostart: boolean
}

const defaultConfig: Settings = {
  listenImage: true,
  autostart: false
}

const clipLimits = {
  text: 100,
  image: 20
}

let clips: Clip[] = []
let config: Settings = { ...defaultConfig }
let dataDir = ''
let imagesDir = ''
let clipsFile = ''

// 初始化存储目录并加载历史数据（userData/data 下）
export function initStore() {
  dataDir = path.join(app.getPath('userData'), 'data')
  imagesDir = path.join(dataDir, 'images')
  clipsFile = path.join(dataDir, 'clips.jsonl')
  fs.mkdirSync(imagesDir, { recursive: true })
  loadConfig()
  loadClips()
}

export function getImagesDir(): string {
  return imagesDir
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(path.join(dataDir, 'config.json'), 'utf-8')
    config = { ...defaultConfig, ...JSON.parse(raw) }
  } catch {
    // 首次启动没有配置文件，用默认值
  }
}

function loadClips() {
  try {
    const raw = fs.readFileSync(clipsFile, 'utf-8')
    clips = raw
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
    if (enforceClipLimits()) rewriteClipsFile()
  } catch {
    // 首次启动没有记录文件
  }
}

// 按类型和关键字分批读取记录，供界面连续滚动加载
export function getClips(type?: Clip['type'], offset = 0, limit = clips.length, keyword = ''): Clip[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()
  const filtered = clips.filter((clip) => {
    if (type && clip.type !== type) return false
    if (!normalizedKeyword) return true
    return clip.type === 'text' && clip.content.toLocaleLowerCase().includes(normalizedKeyword)
  })
  return filtered.slice(offset, offset + limit)
}

// 返回文本和图片各自的记录数量
export function getClipCounts() {
  return {
    text: clips.filter((clip) => clip.type === 'text').length,
    image: clips.filter((clip) => clip.type === 'image').length
  }
}

// 根据记录 id 获取原始数据，供复制操作使用
export function getClipById(id: number): Clip | undefined {
  return clips.find((clip) => clip.id === id)
}

export function getConfig(): Settings {
  return config
}

// 追加一条记录；文本和图片分别超过上限时删除各自最旧的记录
export function appendClip(clip: Clip) {
  clips.unshift(clip)
  enforceClipLimits()
  rewriteClipsFile()
}

// 删除单条记录（图片一并删除磁盘文件）
export function deleteClip(id: number) {
  const index = clips.findIndex((c) => c.id === id)
  if (index === -1) return
  removeImageFile(clips[index])
  clips.splice(index, 1)
  rewriteClipsFile()
}

// 清空全部记录
export function clearClips(type: Clip['type']) {
  const removed = clips.filter((clip) => clip.type === type)
  removed.forEach(removeImageFile)
  clips = clips.filter((clip) => clip.type !== type)
  rewriteClipsFile()
}

// 更新监听和开机自启配置，并立即保存
export function setConfig(partial: Partial<Settings>): Settings {
  config = { ...config, ...partial }
  saveConfig()
  return config
}

function saveConfig() {
  fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify(config, null, 2))
}

// 删除图片记录对应的磁盘文件
function removeImageFile(clip: Clip) {
  if (clip.type === 'image') {
    fs.rmSync(path.join(imagesDir, clip.content), { force: true })
  }
}

// 分别保留最新的 100 条文本和 20 张图片，并清理超限图片文件
function enforceClipLimits(): boolean {
  const typeCounts = { text: 0, image: 0 }
  const retained: Clip[] = []
  const removed: Clip[] = []
  clips.forEach((clip) => {
    typeCounts[clip.type]++
    if (typeCounts[clip.type] <= clipLimits[clip.type]) retained.push(clip)
    else removed.push(clip)
  })
  if (!removed.length) return false
  clips = retained
  removed.forEach(removeImageFile)
  return true
}

// 原子重写记录文件：先写临时文件再改名，避免写一半损坏
function rewriteClipsFile() {
  const tmp = clipsFile + '.tmp'
  fs.writeFileSync(tmp, clips.map((c) => JSON.stringify(c)).join('\n'))
  fs.renameSync(tmp, clipsFile)
}
