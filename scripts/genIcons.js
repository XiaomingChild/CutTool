// 生成应用图标与托盘图标（纯 Node，无第三方依赖）
// 用法: node scripts/genIcons.js
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const outDir = path.join(__dirname, '..', 'resources')
fs.mkdirSync(outDir, { recursive: true })

// ---------- 简易 PNG 编码器 (RGBA) ----------
function createPng(size, drawPixel) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // 每行前置 filter 字节
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = drawPixel(x, y)
      const off = y * stride + 1 + x * 4
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
      raw[off + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 6 // RGBA
  const chunks = []
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  chunks.push(chunk('IHDR', ihdr))
  chunks.push(chunk('IDAT', zlib.deflateSync(raw)))
  chunks.push(chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(chunks)
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

const crcTable = (() => {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// 圆角矩形判定
function inRoundedRect(x, y, left, top, width, height, radius) {
  const cx = Math.min(Math.max(x, left + radius), left + width - radius)
  const cy = Math.min(Math.max(y, top + radius), top + height - radius)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

// 图标绘制：蓝色圆角底板 + 白色卡片 + 两条"文本行"
function drawPixel(x, y, size) {
  const u = size / 256
  const BLUE = [0x4a, 0x6c, 0xf7]
  // 底板
  if (!inRoundedRect(x, y, 0, 0, size, size, 52 * u)) return [0, 0, 0, 0]
  let c = [...BLUE, 255]
  // 白色卡片
  const cl = 84 * u
  const ct = 70 * u
  const cw = size - 168 * u
  const ch = size - 140 * u
  if (inRoundedRect(x, y, cl, ct, cw, ch, 20 * u)) c = [255, 255, 255, 255]
  // 卡片内文本行
  const lineH = 9 * u
  const lineW = cw * 0.52
  const lx = cl + cw * 0.16
  const ly1 = ct + ch * 0.32
  const ly2 = ct + ch * 0.62
  if (x >= lx && x <= lx + lineW && y >= ly1 && y <= ly1 + lineH) c = [...BLUE, 255]
  if (x >= lx && x <= lx + lineW * 0.68 && y >= ly2 && y <= ly2 + lineH) c = [...BLUE, 255]
  return c
}

fs.writeFileSync(path.join(outDir, 'icon.png'), createPng(256, (x, y) => drawPixel(x, y, 256)))
fs.writeFileSync(path.join(outDir, 'tray.png'), createPng(32, (x, y) => drawPixel(x, y, 32)))
console.log('icons generated:', path.join(outDir, 'icon.png'), path.join(outDir, 'tray.png'))
