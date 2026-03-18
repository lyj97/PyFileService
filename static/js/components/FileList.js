// 文件列表组件（搜索、排序、预览、下载、删除）
export default {
  name: "FileList",
  props: {
    files: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["preview", "delete", "search-change", "sort-change"],
  data() {
    return {
      searchText: "",
      sortBy: "upload_time",
      sortOrder: "desc",
      // 删除确认弹窗
      confirmFile: null,
    };
  },
  computed: {
    sortOptions() {
      return [
        { value: "upload_time_desc", label: "上传时间 ↓" },
        { value: "upload_time_asc",  label: "上传时间 ↑" },
        { value: "size_desc",        label: "文件大小 ↓" },
        { value: "size_asc",         label: "文件大小 ↑" },
        { value: "original_name_asc", label: "文件名 A-Z" },
        { value: "original_name_desc", label: "文件名 Z-A" },
      ];
    },
  },
  methods: {
    // 获取文件类型图标和样式类
    getFileIcon(mimeType) {
      const mime = mimeType || "";
      if (mime.startsWith("image/"))  return { icon: "🖼", cls: "type-image" };
      if (mime.startsWith("video/"))  return { icon: "🎬", cls: "type-video" };
      if (mime.startsWith("audio/"))  return { icon: "🎵", cls: "type-audio" };
      if (mime === "application/pdf") return { icon: "📕", cls: "type-pdf" };
      if (mime.startsWith("text/") || mime === "application/json")
                                      return { icon: "📝", cls: "type-text" };
      return { icon: "📄", cls: "type-other" };
    },

    // 格式化文件大小
    formatSize(bytes) {
      if (!bytes) return "0 B";
      const units = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    },

    // 格式化上传时间
    formatTime(isoStr) {
      if (!isoStr) return "";
      const d = new Date(isoStr + "Z"); // UTC 时间加 Z 后转本地时间
      const pad = n => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `
           + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    // 判断是否可预览
    canPreview(mimeType) {
      const mime = mimeType || "";
      return (
        mime.startsWith("image/") ||
        mime.startsWith("video/") ||
        mime.startsWith("audio/") ||
        mime === "application/pdf" ||
        mime.startsWith("text/") ||
        mime === "application/json" ||
        mime === "application/xml"
      );
    },

    // 搜索输入防抖
    onSearchInput() {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.$emit("search-change", this.searchText);
      }, 300);
    },

    // 排序变化：value 格式如 "upload_time_desc" / "size_asc" / "original_name_asc"
    onSortChange(value) {
      // 末尾是 asc 或 desc
      const order = value.endsWith("_asc") ? "asc" : "desc";
      // sortBy 是去掉末尾 _asc / _desc 后的部分
      const sortBy = value.replace(/_asc$/, "").replace(/_desc$/, "");
      this.$emit("sort-change", { sortBy, order });
    },

    // 点击预览
    onPreview(file) {
      this.$emit("preview", file);
    },

    // 点击删除 -> 显示确认
    onDeleteClick(file) {
      this.confirmFile = file;
    },

    // 确认删除
    confirmDelete() {
      if (this.confirmFile) {
        this.$emit("delete", this.confirmFile.id);
        this.confirmFile = null;
      }
    },

    // 取消删除
    cancelDelete() {
      this.confirmFile = null;
    },
  },
  template: `
    <div class="card file-list-card">
      <!-- 标题 + 搜索 + 排序 -->
      <div class="file-list-header">
        <div class="card-title" style="margin-bottom: 0;">文件列表</div>
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchText"
            type="text"
            placeholder="搜索文件名..."
            @input="onSearchInput"
          />
        </div>
        <select class="sort-select" @change="onSortChange($event.target.value)">
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" style="display: flex; justify-content: center; padding: 60px 0;">
        <div class="loading-spinner"></div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="files.length === 0" class="empty-state">
        <span class="empty-icon">🗂</span>
        <p>还没有文件，赶快上传第一个吧！</p>
      </div>

      <!-- 文件列表 -->
      <div v-else class="file-list">
        <div
          v-for="file in files"
          :key="file.id"
          class="file-item"
        >
          <!-- 文件类型图标 -->
          <div class="file-icon" :class="getFileIcon(file.mime_type).cls">
            {{ getFileIcon(file.mime_type).icon }}
          </div>

          <!-- 文件信息 -->
          <div class="file-info">
            <div class="file-name" :title="file.original_name">{{ file.original_name }}</div>
            <div class="file-meta">{{ formatSize(file.size) }} · {{ formatTime(file.upload_time) }}</div>
          </div>

          <!-- 操作按钮 -->
          <div class="file-actions">
            <button
              v-if="canPreview(file.mime_type)"
              class="btn btn-outline"
              @click="onPreview(file)"
            >预览</button>
            <a
              :href="'/api/files/' + file.id + '/download'"
              :download="file.original_name"
              class="btn btn-outline"
            >下载</a>
            <button class="btn btn-danger" @click="onDeleteClick(file)">删除</button>
          </div>
        </div>
      </div>

      <!-- 删除确认弹窗 -->
      <div v-if="confirmFile" class="modal-overlay" @click.self="cancelDelete">
        <div class="confirm-dialog">
          <span class="confirm-icon">🗑</span>
          <h3>确认删除</h3>
          <p>即将删除文件「{{ confirmFile.original_name }}」，此操作不可撤销。</p>
          <div class="confirm-actions">
            <button class="btn-secondary" @click="cancelDelete">取消</button>
            <button class="btn-danger-fill" @click="confirmDelete">确认删除</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
