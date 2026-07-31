/// <reference types="vite/client" />

declare module '*.vue' {
  const component: any
  export default component
}

interface Clip {
  id: number
  type: 'text' | 'image'
  content: string
  createdAt: number
}

interface Settings {
  listenImage: boolean
  autostart: boolean
}

interface ClipQuery {
  type: Clip['type']
  offset: number
  limit: number
  keyword?: string
}

interface ClipCounts {
  text: number
  image: number
}

interface Window {
  cutTool: {
    getClips: (query: ClipQuery) => Promise<Clip[]>
    getClipCounts: () => Promise<ClipCounts>
    deleteClip: (id: number) => Promise<boolean>
    clearType: (type: Clip['type']) => Promise<ClipCounts>
    copyClip: (id: number) => Promise<boolean>
    getConfig: () => Promise<Settings>
    setConfig: (partial: Partial<Settings>) => Promise<Settings>
    hideWindow: () => Promise<void>
    setPinned: (pinned: boolean) => Promise<boolean>
    getPinned: () => Promise<boolean>
    onClipsUpdated: (callback: () => void) => () => void
  }
}
