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
const clearing = ref(false)
const pageSizes: Record<ClipType, number> = { text: 20, image: 8 }
let searchTimer: ReturnType<typeof setTimeout> | undefined
let clearTimer: ReturnType<typeof setTimeout> | undefined
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
})

onUnmounted(() => {
  unsubscribe?.()
  if (searchTimer) clearTimeout(searchTimer)
  if (clearTimer) clearTimeout(clearTimer)
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
  dirty.text = true
  dirty.image = true
  await refreshCounts()
  await resetType(activeType.value)
}

// 点击记录后复制回系统剪贴板，未固定时收起窗口
async function copyClip(clip: Clip) {
  const copied = await window.cutTool.copyClip(clip.id)
  if (!copied) return
  if (!(await window.cutTool.getPinned())) window.cutTool.hideWindow()
}

// 删除单条记录并刷新当前分类
async function deleteClip(clip: Clip) {
  await window.cutTool.deleteClip(clip.id)
  await refreshCounts()
  await resetType(activeType.value)
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
      <button v-for="clip in records.text" :key="clip.id" class="text-item" @click="copyClip(clip)">
        <span class="type-icon">T</span>
        <span class="item-body">
          <span class="preview">{{ clip.content }}</span>
          <span class="time">{{ formatTime(clip.createdAt) }}</span>
        </span>
        <span class="copy-icon" title="复制">▢</span>
        <span class="delete-icon" title="删除" @click.stop="deleteClip(clip)">×</span>
      </button>
      <div v-if="!records.text.length && !loading.text" class="empty">
        {{ query ? '没有匹配的文本' : '暂无文本记录' }}
      </div>
      <div v-if="loading.text" class="loading">正在加载...</div>
    </div>

    <div
      v-show="activeType === 'image'"
      class="content-list image-list"
      @scroll="handleScroll($event, 'image')"
    >
      <button v-for="clip in records.image" :key="clip.id" class="image-item" @click="copyClip(clip)">
        <img :src="`clip-image://img/${clip.content}`" alt="剪贴板图片" draggable="false" />
        <span class="image-meta">{{ formatTime(clip.createdAt) }}</span>
        <span class="image-actions">
          <span title="复制">▢</span>
          <span title="删除" @click.stop="deleteClip(clip)">×</span>
        </span>
      </button>
      <div v-if="!records.image.length && !loading.image" class="empty image-empty">暂无图片记录</div>
      <div v-if="loading.image" class="loading image-loading">正在加载...</div>
    </div>

    <div class="footer">
      <span>共 {{ currentCount }} {{ currentLabel }}</span>
      <button :class="{ confirm: clearing }" @click="clearCurrentType">
        {{ clearing ? '确认清空?' : `清空${activeType === 'text' ? '文本' : '图片'}` }}
      </button>
    </div>

    <SettingsPanel v-if="settingsOpen" @close="settingsOpen = false" />
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
  border-top: 1px solid var(--border);
}
.text-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 66px;
  gap: 10px;
  padding: 9px 40px 9px 8px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.text-item:hover {
  background: var(--panel);
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
.copy-icon,
.delete-icon {
  position: absolute;
  right: 12px;
  font-size: 19px;
  color: var(--text-2);
}
.delete-icon {
  display: none;
  color: var(--danger);
}
.text-item:hover .copy-icon {
  display: none;
}
.text-item:hover .delete-icon {
  display: block;
}

.image-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 8px;
  padding: 2px 4px 10px;
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
}
.image-item:hover {
  border-color: #454751;
}
.image-item img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: contain;
  background: #111216;
}
.image-meta {
  padding: 7px 8px;
  text-align: left;
}
.image-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: none;
  gap: 5px;
}
.image-item:hover .image-actions {
  display: flex;
}
.image-actions span {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 5px;
  background: rgba(18, 19, 23, 0.88);
  color: #fff;
  font-size: 17px;
}
.image-actions span:last-child:hover {
  color: var(--danger);
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
  min-height: 40px;
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
}
.footer button:hover,
.footer button.confirm {
  border-color: rgba(255, 107, 107, 0.45);
  color: var(--danger);
}
</style>
