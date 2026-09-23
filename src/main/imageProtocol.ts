import { protocol } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

let imagesDir = ''

// 自定义协议需在 app ready 之前声明
export function registerSchemes() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'clip-image',
      privileges: { secure: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

// 注册 clip-image://img/<文件名> 协议，让渲染进程能展示本地图片
export function registerImageProtocol(dir: string) {
  imagesDir = dir
  protocol.handle('clip-image', (request) => {
    const file = path.basename(decodeURIComponent(new URL(request.url).pathname))
    const fullPath = path.join(imagesDir, file)
    if (!fs.existsSync(fullPath)) {
      return new Response('Not Found', { status: 404 })
    }
    const data = fs.readFileSync(fullPath)
    return new Response(data, { headers: { 'content-type': 'image/png' } })
  })
}
