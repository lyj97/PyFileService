// 文件预览弹窗组件
export default {
  name: "Preview",
  props: {
    // 要预览的文件记录，null 时不显示
    file: {
      type: Object,
      default: null,
    },
  },
  emits: ["close"],
  data() {
    return {
      loading: false,       // 正在加载预览内容
      textContent: "",      // 文本类文件内容
      error: "",            // 错误信息
    };
  },
  computed: {
    // 根据 MIME 类型判断预览类型
    previewType() {
      if (!this.file) return "none";
      const mime = this.file.mime_type || "";
      if (mime.startsWith("image/")) return "image";
      if (mime.startsWith("video/")) return "video";
      if (mime.startsWith("audio/")) return "audio";
      if (mime === "application/pdf") return "pdf";
      if (
        mime.startsWith("text/") ||
        mime === "application/json" ||
        mime === "application/xml"
      ) return "text";
      return "unsupported";
    },
    // 图片/视频/音频/PDF 的直接流地址
    streamUrl() {
      if (!this.file) return "";
      return `/api/files/${this.file.id}/preview`;
    },
    // 下载地址（用于不支持预览时引导下载）
    downloadUrl() {
      if (!this.file) return "";
      return `/api/files/${this.file.id}/download`;
    },
  },
  watch: {
    // 文件变化时加载文本内容
    file(newFile) {
      this.textContent = "";
      this.error = "";
      if (newFile && this.previewType === "text") {
        this.loadTextContent(newFile.id);
      }
    },
  },
  methods: {
    // 加载文本文件内容
    async loadTextContent(fileId) {
      this.loading = true;
      try {
        const res = await fetch(`/api/files/${fileId}/preview`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.textContent = data.content || "";
      } catch (e) {
        this.error = e.message || "加载失败";
      } finally {
        this.loading = false;
      }
    },
    // 关闭弹窗
    close() {
      this.$emit("close");
    },
    // 点击遮罩关闭
    onOverlayClick(e) {
      if (e.target === e.currentTarget) this.close();
    },
    // 格式化文件大小
    formatSize(bytes) {
      if (!bytes) return "0 B";
      const units = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    },
  },
  template: `
    <div v-if="file" class="modal-overlay" @click="onOverlayClick">
      <div class="modal">
        <!-- 弹窗头部 -->
        <div class="modal-header">
          <div class="modal-title" :title="file.original_name">
            {{ file.original_name }}
            <span style="font-size: 12px; color: var(--text-secondary); font-weight: 400; margin-left: 8px;">
              {{ formatSize(file.size) }}
            </span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <a :href="downloadUrl" :download="file.original_name" class="btn btn-outline" style="font-size: 12px;">
              下载
            </a>
            <button class="modal-close" @click="close">✕</button>
          </div>
        </div>

        <!-- 弹窗内容 -->
        <div class="modal-body">
          <!-- 加载中 -->
          <div v-if="loading" class="loading-spinner"></div>

          <!-- 错误 -->
          <div v-else-if="error" class="preview-unsupported">
            <span class="unsupported-icon">⚠️</span>
            <p>{{ error }}</p>
          </div>

          <!-- 图片预览 -->
          <img
            v-else-if="previewType === 'image'"
            :src="streamUrl"
            :alt="file.original_name"
            class="preview-image"
          />

          <!-- 视频预览 -->
          <video
            v-else-if="previewType === 'video'"
            :src="streamUrl"
            controls
            class="preview-video"
          ></video>

          <!-- 音频预览 -->
          <audio
            v-else-if="previewType === 'audio'"
            :src="streamUrl"
            controls
            class="preview-audio"
          ></audio>

          <!-- PDF 预览 -->
          <iframe
            v-else-if="previewType === 'pdf'"
            :src="streamUrl"
            class="preview-iframe"
          ></iframe>

          <!-- 文本预览 -->
          <pre v-else-if="previewType === 'text'" class="preview-text">{{ textContent }}</pre>

          <!-- 不支持预览 -->
          <div v-else class="preview-unsupported">
            <span class="unsupported-icon">📄</span>
            <p>该文件类型暂不支持预览</p>
            <a :href="downloadUrl" :download="file.original_name" class="btn-primary" style="display: inline-block; margin-top: 16px; text-decoration: none; padding: 8px 20px; border-radius: 8px; font-size: 13px;">
              下载文件
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
};
