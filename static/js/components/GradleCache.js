const { ref, onMounted, computed } = Vue;

export default {
  name: "GradleCache",

  setup() {
    const entries      = ref([]);
    const loading      = ref(false);
    const serverStatus = ref("checking"); // "checking" | "ok" | "error"
    const deleteTarget = ref(null);       // 待删除的 key
    const toasts       = ref([]);

    let toastId = 0;
    function showToast(msg, type = "info", duration = 3000) {
      const id = ++toastId;
      toasts.value.push({ id, msg, type });
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id);
      }, duration);
    }

    // 检查缓存服务可达性（同源，直接请求列表接口）
    async function checkServer() {
      serverStatus.value = "checking";
      try {
        const res = await fetch("/api/gradle-cache", { signal: AbortSignal.timeout(5000) });
        serverStatus.value = res.ok ? "ok" : "error";
      } catch {
        serverStatus.value = "error";
      }
    }

    // 加载所有缓存 key
    async function loadEntries() {
      loading.value = true;
      try {
        const res = await fetch("/api/gradle-cache");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        entries.value = data.entries || [];
      } catch (e) {
        showToast("加载失败：" + e.message, "error");
      } finally {
        loading.value = false;
      }
    }

    // 刷新
    async function refresh() {
      await checkServer();
      await loadEntries();
      showToast("已刷新", "success", 1500);
    }

    // 下载某个 key
    function downloadKey(key) {
      const a = document.createElement("a");
      a.href = `/api/gradle-cache/${key}`;
      a.download = key;
      a.click();
    }

    // 确认删除弹窗
    function askDelete(key) {
      deleteTarget.value = key;
    }

    function cancelDelete() {
      deleteTarget.value = null;
    }

    // 执行删除
    async function confirmDelete() {
      const key = deleteTarget.value;
      deleteTarget.value = null;
      try {
        const res = await fetch(`/api/gradle-cache/${key}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast(`已删除: ${key}`, "success");
        await loadEntries();
      } catch (e) {
        showToast("删除失败：" + e.message, "error");
      }
    }

    // 总缓存大小
    const totalSizeMB = computed(() =>
      entries.value.reduce((s, e) => s + e.size_mb, 0).toFixed(1)
    );

    onMounted(async () => {
      await checkServer();
      await loadEntries();
    });

    return {
      entries, loading, serverStatus, deleteTarget, toasts,
      totalSizeMB,
      refresh, downloadKey, askDelete, cancelDelete, confirmDelete,
    };
  },

  template: `
    <div class="gc-page">

      <!-- 状态栏 -->
      <div class="gc-header card" style="margin-bottom:20px;">
        <div class="gc-header-left">
          <div class="card-title" style="margin-bottom:0">Gradle 构建缓存</div>
          <div class="gc-meta">
            共 {{ entries.length }} 个 key &nbsp;·&nbsp; 合计 {{ totalSizeMB }} MB
          </div>
        </div>
        <div class="gc-header-right">
          <!-- 服务可达状态 -->
          <div class="gc-status" :class="serverStatus">
            <span class="gc-status-dot"></span>
            <span v-if="serverStatus === 'checking'">检测中…</span>
            <span v-else-if="serverStatus === 'ok'">服务正常</span>
            <span v-else>服务不可达</span>
          </div>
          <button class="btn btn-outline" @click="refresh" :disabled="loading">
            {{ loading ? '刷新中…' : '刷新' }}
          </button>
        </div>
      </div>

      <!-- 缓存 key 列表 -->
      <div class="card">
        <div v-if="loading" class="gc-empty">
          <div class="loading-spinner" style="margin:0 auto 12px;"></div>
          加载中…
        </div>
        <div v-else-if="entries.length === 0" class="gc-empty">
          暂无缓存记录<br/>
          <span style="font-size:12px;color:var(--text-secondary);margin-top:6px;display:block;">
            CI 构建完成后会自动上传
          </span>
        </div>
        <table v-else class="gc-table">
          <thead>
            <tr>
              <th>Key</th>
              <th style="width:100px;text-align:right">大小</th>
              <th style="width:160px">更新时间</th>
              <th style="width:100px;text-align:center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in entries" :key="e.key">
              <td>
                <span class="gc-key-badge" :class="keyType(e.key)">
                  {{ keyLabel(e.key) }}
                </span>
                <span class="gc-key-name">{{ e.key }}</span>
              </td>
              <td style="text-align:right;color:var(--text-secondary);font-variant-numeric:tabular-nums">
                {{ e.size_mb }} MB
              </td>
              <td style="color:var(--text-secondary);font-size:12px">{{ e.mtime }}</td>
              <td style="text-align:center">
                <button class="btn btn-outline" style="margin-right:4px" @click="downloadKey(e.key)" title="下载">↓</button>
                <button class="btn btn-danger" @click="askDelete(e.key)" title="删除">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 删除确认弹窗 -->
      <div v-if="deleteTarget" class="modal-overlay" @click.self="cancelDelete">
        <div class="modal-box">
          <div class="modal-title">确认删除</div>
          <div class="modal-body" style="word-break:break-all">
            删除缓存 key：<br/>
            <code style="font-size:12px;color:var(--primary)">{{ deleteTarget }}</code>
            <br/><br/>
            <span style="color:var(--text-secondary);font-size:12px">
              删除后下次 CI 构建将重新生成此缓存（约增加 15-25 分钟构建时间）
            </span>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="cancelDelete">取消</button>
            <button class="btn btn-danger-fill" @click="confirmDelete">确认删除</button>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div class="toast-container">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">{{ t.msg }}</div>
      </div>
    </div>
  `,

  methods: {
    keyType(key) {
      if (key.includes("latest"))  return "latest";
      if (key.includes("stable"))  return "stable";
      if (key.includes("jars"))    return "jars";
      return "other";
    },
    keyLabel(key) {
      if (key.includes("latest"))  return "latest";
      if (key.includes("stable"))  return "deps";
      if (key.includes("jars"))    return "jars";
      return "key";
    },
  },
};
