// 存储用量展示组件（展示主机/容器真实磁盘空间）
export default {
  name: "StorageBar",
  props: {
    stats: {
      type: Object,
      default: () => ({ total: 0, used: 0, free: 0, used_files: 0, file_count: 0 }),
    },
  },
  computed: {
    // 磁盘整体已用百分比
    usedPercent() {
      if (!this.stats.total) return 0;
      return Math.min((this.stats.used / this.stats.total) * 100, 100).toFixed(1);
    },
    // 本服务文件占总磁盘百分比
    filesPercent() {
      if (!this.stats.total) return 0;
      return Math.min((this.stats.used_files / this.stats.total) * 100, 100).toFixed(1);
    },
    // 进度条颜色：根据磁盘整体用量决定
    barClass() {
      const p = parseFloat(this.usedPercent);
      if (p >= 90) return "danger";
      if (p >= 70) return "warning";
      return "";
    },
  },
  methods: {
    formatSize(bytes) {
      if (!bytes) return "0 B";
      const units = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    },
  },
  template: `
    <div class="card storage-card">
      <div class="card-title">磁盘空间</div>

      <!-- 已用 / 总量 -->
      <div class="storage-numbers">
        <span class="used">已用 {{ formatSize(stats.used) }}</span>
        <span>共 {{ formatSize(stats.total) }}</span>
      </div>

      <!-- 磁盘用量进度条 -->
      <div class="storage-bar-wrap">
        <div
          class="storage-bar"
          :class="barClass"
          :style="{ width: usedPercent + '%' }"
        ></div>
      </div>

      <!-- 剩余 -->
      <div class="storage-detail">
        <span>{{ usedPercent }}% 已使用</span>
        <span>剩余 {{ formatSize(stats.free) }}</span>
      </div>

      <!-- 分割线 -->
      <div style="border-top: 1px solid var(--border); margin: 12px 0;"></div>

      <!-- 本服务占用 -->
      <div style="font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between;">
        <span>本服务文件占用</span>
        <span style="color: var(--primary); font-weight: 600;">{{ formatSize(stats.used_files) }}</span>
      </div>
      <div style="margin-top: 6px; font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between;">
        <span>文件数量</span>
        <span>{{ stats.file_count }} 个</span>
      </div>
    </div>
  `,
};
