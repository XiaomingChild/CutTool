import { BrowserWindow, app, screen } from 'electron'
import * as path from 'path'

let win: BrowserWindow | null = null
let pinned = false

// 创建无边框悬浮小窗（默认隐藏，常驻托盘）
export function createWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: 400,
    height: 560,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    backgroundColor: '#16171c',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 开发模式走 dev server，生产模式加载打包产物
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 未固定时，失焦自动隐藏
  win.on('blur', () => {
    if (!pinned) hideWindow()
  })

  // 点关闭一律隐藏到托盘，不退出应用
  win.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      hideWindow()
    }
  })

  return win
}

export function getWindow(): BrowserWindow | null {
  return win
}

// 唤起/隐藏悬浮窗（全局快捷键与托盘调用）
export function toggleWindow() {
  if (!win) return
  if (win.isVisible() && win.isFocused()) {
    hideWindow()
    return
  }
  positionNearCursor()
  win.show()
  win.focus()
}

export function hideWindow() {
  win?.hide()
}

// 固定窗口：置顶 + 失焦不隐藏
export function setPinned(value: boolean) {
  pinned = value
  win?.setAlwaysOnTop(value, 'floating')
}

export function getPinned(): boolean {
  return pinned
}

// 计算窗口位置：跟随鼠标，并保证完整落在工作区内
function positionNearCursor() {
  if (!win) return
  const cursor = screen.getCursorScreenPoint()
  const { width, height } = win.getBounds()
  const area = screen.getDisplayNearestPoint(cursor).workArea
  let x = cursor.x - 24
  let y = cursor.y - 24
  x = Math.min(Math.max(x, area.x), area.x + area.width - width)
  y = Math.min(Math.max(y, area.y), area.y + area.height - height)
  win.setPosition(Math.round(x), Math.round(y))
}
