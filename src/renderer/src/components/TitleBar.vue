<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{ (e: 'open-settings'): void }>()

const pinned = ref(false)

onMounted(async () => {
  pinned.value = await window.cutTool.getPinned()
})

// 关闭窗口并退出整个应用进程
function quit() {
  window.cutTool.quitApp()
}

// 最小化到任务栏
function minimize() {
  window.cutTool.minimizeWindow()
}

// 切换窗口置顶状态
async function togglePin() {
  pinned.value = await window.cutTool.setPinned(!pinned.value)
}
</script>

<template>
  <div class="titlebar">
    <span class="brand">CutTool</span>
    <div class="actions">
      <button class="btn" :class="{ active: pinned }" title="固定窗口" @click="togglePin">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 17s-6-5.1-6-9a6 6 0 1 1 12 0c0 3.9-6 9-6 9z" />
          <circle cx="12" cy="8" r="2.5" />
        </svg>
      </button>
      <button class="btn" title="设置" @click="emit('open-settings')">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="4" y1="8" x2="20" y2="8" />
          <circle cx="9" cy="8" r="2.5" />
          <line x1="4" y1="16" x2="20" y2="16" />
          <circle cx="15" cy="16" r="2.5" />
        </svg>
      </button>
      <button class="btn" title="最小化" @click="minimize">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="5" y1="17" x2="19" y2="17" />
        </svg>
      </button>
      <button class="btn close" title="退出程序" @click="quit">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 8px 0 12px;
  -webkit-app-region: drag;
}
.brand {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--text-2);
}
.actions {
  display: flex;
  gap: 2px;
  -webkit-app-region: no-drag;
}
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.1s;
}
.btn:hover {
  background: var(--panel);
  color: var(--text);
}
.btn.active {
  color: var(--accent);
}
.btn:active {
  transform: scale(0.9);
}
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.btn.close:hover {
  background: var(--danger);
  color: #fff;
}
</style>
