import Uploader   from "./components/Uploader.js";
import FileList   from "./components/FileList.js";
import Preview    from "./components/Preview.js";
import StorageBar from "./components/StorageBar.js";

const { createApp, ref, reactive, onMounted } = Vue;

const App = {
  components: { Uploader, FileList, Preview, StorageBar },

  setup() {
    // ===== 状态 =====
    const files        = ref([]);
    const fileLoading  = ref(false);
    const storageStats = ref({ total: 0, used: 0, free: 0, file_count: 0 });
    const previewFile  = ref(null);  // 当前预览的文件
    const toasts       = ref([]);    // Toast 通知列表

    // 当前搜索和排序参数
    const query = reactive({
      search:  "",
      sort_by: "upload_time",
      order:   "desc",
    });

    // ===== Toast 通知 =====
    let toastId = 0;
    function showToast(message, type = "info", duration = 3000) {
      const id = ++toastId;
      toasts.value.push({ id, message, type });
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id);
      }, duration);
    }

    // ===== 加载文件列表 =====
    async function loadFiles() {
      fileLoading.value = true;
      try {
        const params = new URLSearchParams({
          search:  query.search,
          sort_by: query.sort_by,
          order:   query.order,
        });
        const res = await fetch(`/api/files?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        files.value = await res.json();
      } catch (e) {
        showToast("加载文件列表失败：" + e.message, "error");
      } finally {
        fileLoading.value = false;
      }
    }

    // ===== 加载存储统计 =====
    async function loadStorage() {
      try {
        const res = await fetch("/api/storage/stats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        storageStats.value = await res.json();
      } catch (e) {
        console.error("存储统计加载失败", e);
      }
    }

    // ===== 刷新数据（上传完成后调用）=====
    async function onUploadDone() {
      await loadFiles();
      await loadStorage();
      showToast("文件上传成功", "success");
    }

    // ===== 搜索变化 =====
    function onSearchChange(keyword) {
      query.search = keyword;
      loadFiles();
    }

    // ===== 排序变化 =====
    function onSortChange({ sortBy, order }) {
      query.sort_by = sortBy;
      query.order   = order;
      loadFiles();
    }

    // ===== 预览文件 =====
    function onPreview(file) {
      previewFile.value = file;
    }

    // ===== 关闭预览 =====
    function onPreviewClose() {
      previewFile.value = null;
    }

    // ===== 删除文件 =====
    async function onDelete(fileId) {
      try {
        const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast("文件已删除", "success");
        await loadFiles();
        await loadStorage();
      } catch (e) {
        showToast("删除失败：" + e.message, "error");
      }
    }

    // ===== 初始化 =====
    onMounted(async () => {
      await loadFiles();
      await loadStorage();
    });

    return {
      files,
      fileLoading,
      storageStats,
      previewFile,
      toasts,
      onUploadDone,
      onSearchChange,
      onSortChange,
      onPreview,
      onPreviewClose,
      onDelete,
    };
  },

  template: `
    <!-- 顶部导航 -->
    <nav class="navbar">
      <div class="navbar-brand">
        <div class="logo-icon">📂</div>
        PyFileService
      </div>
      <div style="font-size: 13px; color: var(--text-secondary);">
        文件上传 · 下载 · 管理
      </div>
    </nav>

    <!-- 主内容区 -->
    <div class="main-container">
      <!-- 左侧：上传 + 存储统计 -->
      <div>
        <Uploader @upload-done="onUploadDone" />
        <StorageBar :stats="storageStats" />
      </div>

      <!-- 右侧：文件列表 -->
      <FileList
        :files="files"
        :loading="fileLoading"
        @preview="onPreview"
        @delete="onDelete"
        @search-change="onSearchChange"
        @sort-change="onSortChange"
      />
    </div>

    <!-- 预览弹窗 -->
    <Preview :file="previewFile" @close="onPreviewClose" />

    <!-- Toast 通知 -->
    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="toast.type"
      >
        {{ toast.message }}
      </div>
    </div>
  `,
};

// 挂载 Vue 应用
createApp(App).mount("#app");
