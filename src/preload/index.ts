import { contextBridge, ipcRenderer } from 'electron'

// 白名单 API：渲染进程只能调用这里暴露的方法
const api = {
  // 剪贴记录
  getClips: (query: object) => ipcRenderer.invoke('clips:get', query),
  getClipCounts: () => ipcRenderer.invoke('clips:counts'),
  deleteClip: (id: number) => ipcRenderer.invoke('clips:delete', id),
  clearType: (type: 'text' | 'image') => ipcRenderer.invoke('clips:clear', type),
  copyClip: (id: number) => ipcRenderer.invoke('clip:copy', id),
  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial: object) => ipcRenderer.invoke('config:set', partial),
  // 窗口
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  setPinned: (pinned: boolean) => ipcRenderer.invoke('window:setPinned', pinned),
  getPinned: () => ipcRenderer.invoke('window:getPinned'),
  // 剪贴板更新通知（返回取消订阅函数）
  onClipsUpdated: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('clips:updated', listener)
    return () => ipcRenderer.removeListener('clips:updated', listener)
  }
}

contextBridge.exposeInMainWorld('cutTool', api)
