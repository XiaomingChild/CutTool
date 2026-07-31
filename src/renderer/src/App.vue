<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import TitleBar from './components/TitleBar.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { formatTime } from './utils/time'

type ClipType = 'text' | 'image'

const activeType = ref<ClipType>('text')
const records = reactive<Record<ClipType, Clip[]>>({ text: [], image: [] })
const counts = reactive<ClipCounts>({ text: 0, image: 0 })
const loading = reactive<Record<ClipType, boolean>>({ text: false, image: false })
const hasMore = reactive<Record<ClipType, boolean>>({ text: true, image: true })
const dirty = reactive<Record<ClipType, boolean>>({ text: false, image: false })
const requestTokens = reactive<Record<ClipType, number>>({ text: 0, image: 0 })
const query = ref('')
const settingsOpen = ref(false)
const selectedImage = ref<Clip | null>(null)
const copiedId = ref<number | null>(null)
const recentId = ref<number | null>(null)
const clearing = ref(false)
const pageSizes: Record<ClipType, number> = { text: 20, image: 8 }
let searchTimer: ReturnType<typeof setTimeout> | undefined
let clearTimer: ReturnType<typeof setTimeout> | undefined
let copyTimer: ReturnType<typeof setTimeout> | undefined
let recentTimer: ReturnType<typeof setTimeout> | undefined
let unsubscribe: (() => void) | undefined

const currentCount = computed(() => counts[activeType.value])
const currentLabel = computed(() => (activeType.value === 'text' ? '条文本' : '张图片'))
const searchPlaceholder = computed(() =>
  activeType.value === 'text' ? '搜索文本内容' : '图片记录按时间排列'
)

onMounted(async () => {
  await refreshCounts()
  await resetType('text')
  unsubscribe = window.cutTool.onClipsUpdated(handleClipsUpdated)
  window.addEventListener('keydown', handleWindowKeydown)
})

onUnmounted(() => {
  unsubscribe?.()
  window.removeEventListener('keydown', handleWindowKeydown)
  if (searchTimer) clearTimeout(searchTimer)
  if (clearTimer) clearTimeout(clearTimer)
  if (copyTimer) clearTimeout(copyTimer)
  if (recentTimer) clearTimeout(recentTimer)
})

watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => resetType(activeType.value), 180)
})

// 刷新两个分类的记录数量
async function refreshCounts() {
  Object.assign(counts, await window.cutTool.getClipCounts())
}

// 重置指定分类并读取第一批记录
async function resetType(type: ClipType) {
  const token = ++requestTokens[type]
  records[type] = []
  hasMore[type] = true
  loading[type] = true
  const batch = await window.cutTool.getClips({
    type,
    offset: 0,
    limit: pageSizes[type],
    keyword: type === 'text' ? query.value : ''
  })
  if (token !== requestTokens[type]) return
  records[type] = batch
  hasMore[type] = batch.length === pageSizes[type]
  loading[type] = false
  dirty[type] = false
}

// 滚动到底部时继续读取当前分类的下一批记录
async function loadMore(type: ClipType) {
  if (loading[type] || !hasMore[type]) return
  const token = requestTokens[type]
  loading[type] = true
  const batch = await window.cutTool.getClips({
    type,
    offset: records[type].length,
    limit: pageSizes[type],
    keyword: type === 'text' ? query.value : ''
  })
  if (token === requestTokens[type]) {
    records[type].push(...batch)
    hasMore[type] = batch.length === pageSizes[type]
    loading[type] = false
  }
}

// 监听列表滚动，在接近底部时触发连续加载
function handleScroll(event: Event, type: ClipType) {
  const element = event.currentTarget as HTMLElement
  const distance = element.scrollHeight - element.scrollTop - element.clientHeight
  if (distance < 80) loadMore(type)
}

// 切换分类；数据有变化时重新读取该分类
async function switchType(type: ClipType) {
  if (activeType.value === type) return
  activeType.value = type
  clearing.value = false
  if (!records[type].length || dirty[type]) await resetType(type)
}

// 主进程捕获新内容后刷新当前列表，并标记另一分类待刷新
async function handleClipsUpdated() {
  const previousFirstId = records[activeType.value][0]?.id
  dirty.text = true
  dirty.image = true
  await refreshCounts()
  await resetType(activeType.value)
  const currentFirstId = records[activeType.value][0]?.id
  if (currentFirstId && currentFirstId !== previousFirstId) showRecentFeedback(currentFirstId)
}

// 点击复制按钮后写回系统剪贴板，并保持当前窗口显示
async function copyClip(clip: Clip) {
  const copied = await window.cutTool.copyClip(clip.id)
  if (copied) showCopyFeedback(clip.id)
}

// 短暂显示复制成功状态
function showCopyFeedback(id: number) {
  if (copyTimer) clearTimeout(copyTimer)
  copiedId.value = id
  copyTimer = setTimeout(() => (copiedId.value = null), 1100)
}

// 短暂高亮新进入列表的记录
function showRecentFeedback(id: number) {
  if (recentTimer) clearTimeout(recentTimer)
  recentId.value = id
  recentTimer = setTimeout(() => (recentId.value = null), 1400)
}

// 打开图片大图预览
function openImage(clip: Clip) {
  selectedImage.value = clip
}

// 关闭图片大图预览
function closeImage() {
  selectedImage.value = null
}

// 按 Esc 关闭图片预览或设置弹层
function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (selectedImage.value) closeImage()
  else if (settingsOpen.value) settingsOpen.value = false
}

// 二次点击确认后清空当前分类
async function clearCurrentType() {
  if (!clearing.value) {
    clearing.value = true
    clearTimer = setTimeout(() => (clearing.value = false), 2500)
    return
  }
  if (clearTimer) clearTimeout(clearTimer)
  clearing.value = false
  Object.assign(counts, await window.cutTool.clearType(activeType.value))
  await resetType(activeType.value)
}
</script>

<template>
  <div class="app">
    <TitleBar @open-settings="settingsOpen = true" />

    <div class="search">
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <input v-model="query" :placeholder="searchPlaceholder" :disabled="activeType === 'image'" />
    </div>

    <div class="tabs" role="tablist">
      <button :class="{ active: activeType === 'text' }" @click="switchType('text')">
        文本 <span>{{ counts.text }}</span>
      </button>
      <button :class="{ active: activeType === 'image' }" @click="switchType('image')">
        图片 <span>{{ counts.image }}</span>
      </button>
    </div>

    <div
      v-show="activeType === 'text'"
      class="content-list text-list"
      @scroll="handleScroll($event, 'text')"
    >
      <div
        v-for="clip in records.text"
        :key="clip.id"
        class="text-item"
        :class="{ recent: recentId === clip.id }"
      >
        <span class="type-icon">T</span>
        <span class="item-body">
          <span class="preview">{{ clip.content }}</span>
          <span class="time">{{ formatTime(clip.createdAt) }}</span>
        </span>
        <button
          class="copy-button"
          :class="{ copied: copiedId === clip.id }"
          :title="copiedId === clip.id ? '已复制' : '复制文本'"
          @click="copyClip(clip)"
        >
          <svg v-if="copiedId === clip.id" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="8" width="11" height="11" rx="2" />
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
          </svg>
          <span v-if="copiedId === clip.id" class="copy-feedback">已复制</span>
        </button>
      </div>
      <div v-if="!records.text.length && !loading.text" class="empty">
        {{ query ? '没有匹配的文本' : '暂无文本记录' }}
      </div>
      <div v-if="loading.text" class="loading" aria-label="正在加载">
        <span></span><span></span><span></span>
      </div>
    </div>

    <div
      v-show="activeType === 'image'"
      class="content-list image-list"
      @scroll="handleScroll($event, 'image')"
    >
      <div
        v-for="clip in records.image"
        :key="clip.id"
        class="image-item"
        :class="{ recent: recentId === clip.id }"
        role="button"
        tabindex="0"
        title="点击查看大图"
        @click="openImage(clip)"
        @keydown.enter="openImage(clip)"
        @keydown.space.prevent="openImage(clip)"
      >
        <img :src="`clip-image://img/${clip.content}`" alt="剪贴板图片" draggable="false" />
        <span class="image-meta">{{ formatTime(clip.createdAt) }}</span>
        <button
          class="image-copy-button"
          :class="{ copied: copiedId === clip.id }"
          :title="copiedId === clip.id ? '已复制' : '复制图片'"
          @click.stop="copyClip(clip)"
        >
          <svg v-if="copiedId === clip.id" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="8" width="11" height="11" rx="2" />
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
          </svg>
          <span v-if="copiedId === clip.id" class="copy-feedback image-feedback">已复制</span>
        </button>
      </div>
      <div v-if="!records.image.length && !loading.image" class="empty image-empty">暂无图片记录</div>
      <div v-if="loading.image" class="loading image-loading" aria-label="正在加载">
        <span></span><span></span><span></span>
      </div>
    </div>

    <div class="footer">
      <span>共 {{ currentCount }} {{ currentLabel }}</span>
      <button :class="{ confirm: clearing }" @click="clearCurrentType">
        {{ clearing ? '确认清空?' : `清空${activeType === 'text' ? '文本' : '图片'}` }}
      </button>
    </div>

    <SettingsPanel v-if="settingsOpen" @close="settingsOpen = false" />

    <div v-if="selectedImage" class="preview-mask" @click.self="closeImage">
      <div class="preview-panel">
        <button class="preview-close" title="关闭预览" @click="closeImage">×</button>
        <img
          :src="`clip-image://img/${selectedImage.content}`"
          alt="剪贴板图片大图预览"
          draggable="false"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
}

.search {
  position: relative;
  padding: 4px 12px 10px;
}
.search-icon {
  position: absolute;
  left: 23px;
  top: 14px;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  color: var(--text-2);
  pointer-events: none;
}
.search input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 36px;
  border: 1px solid var(--border);
  border-radius: 7px;
  outline: none;
  background: var(--panel);
  color: var(--text);
  font-size: 13px;
}
.search input:focus {
  border-color: var(--accent);
}
.search input:disabled {
  opacity: 0.65;
}

.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin: 0 12px 8px;
  padding: 3px;
  border-radius: 7px;
  background: var(--panel);
}
.tabs button {
  height: 30px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}
.tabs button.active {
  background: var(--panel-2);
  color: var(--text);
}
.tabs span {
  margin-left: 4px;
  font-size: 11px;
  color: var(--text-2);
}

.content-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 8px;
}
.text-list {
  padding: 2px 4px 10px;
  animation: content-enter 0.18s ease-out;
}
.text-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 68px;
  gap: 10px;
  margin-bottom: 6px;
  padding: 9px 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.text-item:hover {
  border-color: var(--border);
  background: var(--panel);
}
.text-item.recent,
.image-item.recent {
  animation: recent-highlight 1.4s ease-out;
}
.type-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 7px;
  background: var(--panel-2);
  color: var(--accent);
  font: 600 17px Georgia, serif;
}
.item-body {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}
.preview {
  display: -webkit-box;
  overflow: hidden;
  line-height: 18px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.time,
.image-meta {
  font-size: 11px;
  color: var(--text-2);
}
.copy-button,
.image-copy-button {
  position: relative;
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-2);
  color: var(--text-2);
  cursor: pointer;
}
.copy-button:hover,
.image-copy-button:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.copy-button:active,
.image-copy-button:active,
.footer button:active {
  transform: scale(0.94);
}
.copy-button:focus-visible,
.image-copy-button:focus-visible,
.footer button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.copy-button.copied,
.image-copy-button.copied {
  border-color: #49b982;
  color: #49b982;
}
.copy-button svg,
.image-copy-button svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
}
.copy-feedback {
  position: absolute;
  right: 0;
  bottom: calc(100% + 7px);
  z-index: 3;
  width: max-content;
  padding: 4px 7px;
  border: 1px solid rgba(73, 185, 130, 0.35);
  border-radius: 5px;
  background: #1b2b25;
  color: #76d5a6;
  font-size: 11px;
  pointer-events: none;
  animation: feedback-enter 0.16s ease-out;
}

.image-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 8px;
  padding: 2px 4px 10px;
  animation: content-enter 0.18s ease-out;
}
.image-item {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  outline: none;
  transform-origin: center;
  transition: transform 0.16s ease-out;
}
.image-item:hover {
  transform: scale(1.015);
}
.image-item img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: contain;
  background: #111216;
}
.image-meta {
  padding: 8px 42px 8px 8px;
  text-align: left;
}
.image-copy-button {
  position: absolute;
  right: 6px;
  bottom: 5px;
  background: rgba(30, 31, 38, 0.94);
}
.image-feedback {
  right: -1px;
}

.preview-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(6, 7, 9, 0.86);
  animation: mask-enter 0.16s ease-out;
}
.preview-panel {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  animation: preview-enter 0.2s ease-out;
}
.preview-panel img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 7px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.42);
}
.preview-close {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: rgba(18, 19, 23, 0.88);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.preview-close:hover {
  background: var(--danger);
}

.empty,
.loading {
  display: grid;
  min-height: 150px;
  place-items: center;
  color: var(--text-2);
  font-size: 12px;
}
.loading {
  display: flex;
  justify-content: center;
  gap: 5px;
  min-height: 40px;
}
.loading span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-2);
  animation: loading-dot 0.9s ease-in-out infinite;
}
.loading span:nth-child(2) {
  animation-delay: 0.12s;
}
.loading span:nth-child(3) {
  animation-delay: 0.24s;
}
.image-empty,
.image-loading {
  grid-column: 1 / -1;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  color: var(--text-2);
  font-size: 12px;
}
.footer button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  color: var(--text-2);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, transform 0.1s;
}
.footer button:hover,
.footer button.confirm {
  border-color: rgba(255, 107, 107, 0.45);
  color: var(--danger);
}

@keyframes content-enter {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes feedback-enter {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes recent-highlight {
  0% { border-color: rgba(108, 140, 255, 0.8); background: rgba(108, 140, 255, 0.16); }
  100% { border-color: transparent; background: transparent; }
}
@keyframes mask-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes preview-enter {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes loading-dot {
  0%, 100% { opacity: 0.35; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-3px); }
}
</style>
