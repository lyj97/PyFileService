// 文件上传组件（支持拖拽 + 点击选择 + 批量上传进度）
export default {
  name: "Uploader",
  emits: ["upload-done"],
  data() {
    return {
      dragover: false,
      // 上传队列：[{ name, progress, status, error }]
      // status: "uploading" | "processing" | "done" | "error"
      uploadQueue: [],
    };
  },
  methods: {
    onDragOver(e) {
      e.preventDefault();
      this.dragover = true;
    },
    onDragLeave() {
      this.dragover = false;
    },
    onDrop(e) {
      e.preventDefault();
      this.dragover = false;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) this.uploadFiles(files);
    },
    onFileChange(e) {
      const files = Array.from(e.target.files);
      if (files.length > 0) this.uploadFiles(files);
      e.target.value = "";
    },

    // 通过索引更新队列项，确保 Vue 响应式系统检测到变化
    updateItem(index, patch) {
      const item = this.uploadQueue[index];
      if (!item) return;
      Object.assign(item, patch);
      // 强制触发数组响应式更新
      this.uploadQueue.splice(index, 1, { ...item, ...patch });
    },

    async uploadFiles(files) {
      // 记录此批次在队列中的起始索引
      const startIndex = this.uploadQueue.length;

      // 加入队列
      files.forEach(f => {
        this.uploadQueue.push({
          name: f.name,
          progress: 0,
          status: "uploading",
          error: "",
        });
      });

      const formData = new FormData();
      files.forEach(f => formData.append("files", f));

      const xhr = new XMLHttpRequest();

      // 数据传输进度（0% → 99%）
      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        // 传输阶段最多显示到 99%，留 1% 给服务端处理
        const percent = Math.min(Math.round((e.loaded / e.total) * 100), 99);
        files.forEach((_, i) => {
          const idx = startIndex + i;
          if (this.uploadQueue[idx]?.status === "uploading") {
            this.updateItem(idx, { progress: percent });
          }
        });
      });

      // 传输完成、等待服务端响应
      xhr.upload.addEventListener("load", () => {
        files.forEach((_, i) => {
          const idx = startIndex + i;
          if (this.uploadQueue[idx]?.status === "uploading") {
            this.updateItem(idx, { status: "processing", progress: 99 });
          }
        });
      });

      // 服务端响应回来
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          let results = [];
          try {
            results = JSON.parse(xhr.responseText);
          } catch {
            files.forEach((_, i) => {
              this.updateItem(startIndex + i, {
                status: "error",
                error: "响应解析失败",
                progress: 100,
              });
            });
            return;
          }

          results.forEach((r, i) => {
            const idx = startIndex + i;
            if (r.success) {
              this.updateItem(idx, { status: "done", progress: 100 });
            } else {
              this.updateItem(idx, {
                status: "error",
                error: r.error || "上传失败",
                progress: 100,
              });
            }
          });

          this.$emit("upload-done");
        } else {
          files.forEach((_, i) => {
            this.updateItem(startIndex + i, {
              status: "error",
              error: `HTTP ${xhr.status}`,
              progress: 100,
            });
          });
        }
      });

      xhr.addEventListener("error", () => {
        files.forEach((_, i) => {
          this.updateItem(startIndex + i, {
            status: "error",
            error: "网络错误",
            progress: 100,
          });
        });
      });

      xhr.open("POST", "/api/files/upload");
      xhr.send(formData);
    },

    clearDone() {
      this.uploadQueue = this.uploadQueue.filter(
        item => item.status === "uploading" || item.status === "processing"
      );
    },
  },
  template: `
    <div class="card">
      <div class="card-title">上传文件</div>

      <!-- 拖拽上传区 -->
      <div
        class="uploader-zone"
        :class="{ dragover }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <span class="upload-icon">📁</span>
        <p class="upload-hint">
          <strong>点击选择文件</strong><br>
          或将文件拖拽到这里<br>
          <span style="font-size: 11px;">支持批量上传</span>
        </p>
        <input type="file" multiple @change="onFileChange" />
      </div>

      <!-- 上传进度列表 -->
      <div v-if="uploadQueue.length > 0" class="upload-progress-list">
        <div
          v-for="(item, idx) in uploadQueue"
          :key="idx"
          class="upload-progress-item"
        >
          <div class="item-name">
            <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              {{ item.name }}
            </span>
            <span
              class="status"
              :class="{ done: item.status === 'done', error: item.status === 'error' }"
            >
              <template v-if="item.status === 'uploading'">{{ item.progress }}%</template>
              <template v-else-if="item.status === 'processing'">处理中...</template>
              <template v-else-if="item.status === 'done'">✓ 完成</template>
              <template v-else>✗ {{ item.error }}</template>
            </span>
          </div>
          <div class="progress-bar-wrap">
            <div
              class="progress-bar"
              :class="{ 'progress-bar-pulse': item.status === 'processing' }"
              :style="{ width: item.progress + '%' }"
            ></div>
          </div>
        </div>

        <button
          class="btn btn-outline"
          style="width: 100%; margin-top: 4px;"
          @click="clearDone"
        >
          清除记录
        </button>
      </div>
    </div>
  `,
};
