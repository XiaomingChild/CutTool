<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{ (e: 'close'): void }>()

const config = ref<Settings>({ listenImage: true, autostart: false })

onMounted(async () => {
  config.value = await window.cutTool.getConfig()
})

// 更新部分配置，主进程立即生效
async function update(patch: Partial<Settings>) {
  config.value = await window.cutTool.setConfig(patch)
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="panel">
      <div class="head">
        <span>设置</span>
        <button class="btn close" title="关闭" @click="emit('close')">×</button>
      </div>

      <div class="row">
        <div class="row-text">
          <div class="label">监听图片</div>
          <div class="desc">复制图片时自动保存</div>
        </div>
        <button
          class="switch"
          :class="{ on: config.listenImage }"
          @click="update({ listenImage: !config.listenImage })"
        >
          <span class="knob" />
        </button>
      </div>

      <div class="row">
        <div class="row-text">
          <div class="label">开机自启</div>
          <div class="desc">开机后常驻后台</div>
        </div>
        <button
          class="switch"
          :class="{ on: config.autostart }"
          @click="update({ autostart: !config.autostart })"
        >
          <span class="knob" />
        </button>
      </div>

      <div class="row storage-row">
        <div class="row-text">
          <div class="label">本地存储上限</div>
          <div class="desc">达到上限后自动清理最早记录</div>
        </div>
        <div class="limits">
          <span>文本 100</span>
          <span>图片 20</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.panel {
  width: 100%;
  max-width: 320px;
  background: var(--panel);
  border-radius: 8px;
  padding: 12px 14px;
  animation: panel-enter 0.18s ease-out;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  padding-bottom: 6px;
}
.btn.close {
  border: none;
  background: none;
  color: var(--text-2);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.btn.close:hover {
  background: var(--panel-2);
  color: var(--text);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.row-text .label {
  font-size: 13px;
}
.row-text .desc {
  font-size: 11px;
  color: var(--text-2);
  margin-top: 2px;
}

.switch {
  position: relative;
  width: 36px;
  height: 20px;
  border: none;
  border-radius: 10px;
  background: var(--panel-2);
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}
.switch:active {
  transform: scale(0.95);
}
.switch.on {
  background: var(--accent);
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.15s;
}
.switch.on .knob {
  left: 18px;
}

.limits {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  font-size: 12px;
  color: var(--text-2);
}

@keyframes panel-enter {
  from { opacity: 0; transform: scale(0.98) translateY(3px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
