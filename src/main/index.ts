import { app, globalShortcut, ipcMain, Menu, Tray, nativeImage } from 'electron'
import * as path from 'path'
import { createWindow, getWindow, hideWindow, setPinned, getPinned, toggleWindow } from './window'
import {
  initStore,
  getClips,
  getClipById,
  getClipCounts,
  deleteClip,
  clearClips,
  getConfig,
  setConfig,
  getImagesDir
} from './store'
import { startClipboardWatcher, copyClip } from './clipboard'
import { registerSchemes, registerImageProtocol } from './imageProtocol'

// 自定义协议需在 app ready 之前声明
registerSchemes()

// 单实例：重复启动时唤起已有窗口
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let tray: Tray | null = null

  // 再次启动时唤起主窗口
  app.on('second-instance', () => toggleWindow())

  // 真正退出时标记，供窗口 close 拦截判断
  app.on('before-quit', () => {
    ;(app as any).isQuitting = true
  })

  app.whenReady().then(() => {
    // 初始化文件存储
    initStore()

    // 注册 clip-image 协议，供渲染进程展示本地图片
    registerImageProtocol(getImagesDir())

    // 主窗口（无边框悬浮小窗，默认隐藏）
    createWindow()

    // 系统托盘（常驻后台的唯一入口）
    createTray()

    // 全局快捷键 Ctrl+Shift+V 唤起/隐藏悬浮窗
    const registered = globalShortcut.register('CommandOrControl+Shift+V', () => toggleWindow())
    if (!registered) {
      tray?.setToolTip('CutTool：Ctrl+Shift+V 注册失败，可能被其他软件占用')
    }

    // 后台轮询剪贴板，变化时通知渲染进程刷新
    startClipboardWatcher(() => {
      getWindow()?.webContents.send('clips:updated')
    })

    // 开机自启按配置恢复
    app.setLoginItemSettings({ openAtLogin: getConfig().autostart })

    // 开机自启启动时不弹窗
    const startHidden =
      process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin
    if (!startHidden) {
      toggleWindow()
    }
  })

  // 创建托盘菜单
  function createTray() {
    const icon = nativeImage.createFromPath(path.join(__dirname, '../../resources/tray.png'))
    tray = new Tray(icon)
    tray.setToolTip('CutTool')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '显示剪贴板', click: () => toggleWindow() },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() }
      ])
    )
    tray.on('double-click', () => toggleWindow())
  }

  // 退出时注销全局快捷键
  app.on('will-quit', () => globalShortcut.unregisterAll())

  // ---------- IPC 白名单 ----------
  ipcMain.handle('clips:get', (_event, query = {}) => {
    return getClips(query.type, query.offset, query.limit, query.keyword)
  })
  ipcMain.handle('clips:counts', () => getClipCounts())
  ipcMain.handle('clips:delete', (_event, id: number) => {
    deleteClip(id)
    return true
  })
  ipcMain.handle('clips:clear', (_event, type) => {
    clearClips(type)
    return getClipCounts()
  })
  ipcMain.handle('clip:copy', (_event, id: number) => {
    const clip = getClipById(id)
    if (!clip) return false
    return copyClip(clip)
  })
  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', (_event, partial) => {
    const config = setConfig(partial)
    // 开机自启改动立即应用到系统
    if (partial.autostart !== undefined) {
      app.setLoginItemSettings({ openAtLogin: config.autostart, args: ['--hidden'] })
    }
    return config
  })
  ipcMain.handle('window:hide', () => hideWindow())
  ipcMain.handle('window:setPinned', (_event, pinned: boolean) => {
    setPinned(pinned)
    return pinned
  })
  ipcMain.handle('window:getPinned', () => getPinned())
}
