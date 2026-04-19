# PyFileService

基于 FastAPI 的多功能文件服务，提供两套 API：

1. **文件管理 API**（`/api/files`）：带数据库记录的上传/下载/预览，适合管理归档文件
2. **文件系统 API**（`/api/fs`）：基于路径直接操作文件系统，支持任意路径的 CRUD

---

## 快速启动

```bash
cd /path/to/PyFileService

# 创建 venv 并安装依赖
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 启动服务（前台）
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8001

# 后台运行
nohup .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8001 > /tmp/pyfileservice.log 2>&1 &
```

- 服务地址：`http://<HOST>:8001`
- Swagger 文档：`http://<HOST>:8001/docs`
- 日志：`/tmp/pyfileservice.log`

---

## 环境配置

```bash
# 可选环境变量（建议生产环境修改默认值）
export FS_API_KEY=your-strong-secret-key   # 文件系统 API 认证 Key（必填，不设置服务将拒绝启动）
export FS_BASE_DIR=/                        # 文件系统 API 根目录（默认 /，即无限制）
```

---

## 文件系统 API（`/api/fs`）

> 支持操作任意路径，所有接口需要 API Key 认证。

### 认证

```
Header: X-API-Key: <your-api-key>
```

以下示例使用变量，请替换为实际地址和 Key：

```bash
BASE="http://localhost:8001"
KEY="your-api-key"
```

### 接口列表

#### 上传文件
```
POST /api/fs/upload?path=<目标目录>
Content-Type: multipart/form-data
字段名: files（复数，支持多文件同时上传）
```

```bash
# 上传单个文件
curl -X POST "$BASE/api/fs/upload?path=/tmp" \
  -H "X-API-Key: $KEY" \
  -F "files=@./myfile.txt"

# 上传多个文件
curl -X POST "$BASE/api/fs/upload?path=/home/uploads" \
  -H "X-API-Key: $KEY" \
  -F "files=@./a.txt" \
  -F "files=@./b.txt"
```

响应：
```json
{
  "uploaded": 2,
  "results": [
    {"filename": "a.txt", "saved_to": "/tmp/a.txt", "size": 1024, "success": true},
    {"filename": "b.txt", "saved_to": "/tmp/b.txt", "size": 2048, "success": true}
  ]
}
```

---

#### 下载文件
```
GET /api/fs/download?path=<文件路径>
```

```bash
curl "$BASE/api/fs/download?path=/tmp/myfile.txt" \
  -H "X-API-Key: $KEY" \
  -O -J
```

---

#### 列出目录
```
GET /api/fs/ls?path=<目录路径>
```

```bash
curl "$BASE/api/fs/ls?path=/tmp" \
  -H "X-API-Key: $KEY"
```

响应：
```json
{
  "path": "/tmp",
  "count": 2,
  "entries": [
    {"name": "subdir", "type": "dir", "size": null, "mtime": "2026-04-15T10:00:00", "path": "/tmp/subdir"},
    {"name": "file.txt", "type": "file", "size": 1234, "mtime": "2026-04-10T09:00:00", "path": "/tmp/file.txt"}
  ]
}
```

---

#### 移动/重命名
```
POST /api/fs/mv
Content-Type: application/json
Body: {"src": "<源路径>", "dst": "<目标路径>"}
```

```bash
curl -X POST "$BASE/api/fs/mv" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"src": "/tmp/old.txt", "dst": "/tmp/new.txt"}'
```

---

#### 删除文件或目录
```
DELETE /api/fs/delete?path=<路径>
```

```bash
# 删除文件
curl -X DELETE "$BASE/api/fs/delete?path=/tmp/myfile.txt" \
  -H "X-API-Key: $KEY"

# 删除目录（递归）
curl -X DELETE "$BASE/api/fs/delete?path=/tmp/mydir" \
  -H "X-API-Key: $KEY"
```

---

### Python 客户端示例

```python
import requests

BASE_URL = "http://localhost:8001"
HEADERS = {"X-API-Key": "your-api-key"}

# 上传（字段名必须是 files，复数）
with open("myfile.txt", "rb") as f:
    resp = requests.post(f"{BASE_URL}/api/fs/upload", params={"path": "/tmp"},
                         headers=HEADERS, files={"files": f})
print(resp.json())

# 列目录
resp = requests.get(f"{BASE_URL}/api/fs/ls", params={"path": "/tmp"}, headers=HEADERS)
for entry in resp.json()["entries"]:
    print(entry["name"], entry["type"], entry.get("size"))

# 下载
resp = requests.get(f"{BASE_URL}/api/fs/download", params={"path": "/tmp/myfile.txt"},
                    headers=HEADERS)
with open("downloaded.txt", "wb") as f:
    f.write(resp.content)

# 移动
resp = requests.post(f"{BASE_URL}/api/fs/mv", headers=HEADERS,
                     json={"src": "/tmp/old.txt", "dst": "/tmp/new.txt"})

# 删除
resp = requests.delete(f"{BASE_URL}/api/fs/delete", params={"path": "/tmp/myfile.txt"},
                       headers=HEADERS)
```

---

## 文件管理 API（`/api/files`）

> 带 SQLite 数据库记录，适合归档管理，文件存储在 `uploads/` 目录下。

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/files` | 获取文件列表（支持搜索、排序） |
| `POST` | `/api/files/upload` | 批量上传文件 |
| `GET` | `/api/files/{id}/download` | 按 ID 下载文件 |
| `GET` | `/api/files/{id}/preview` | 预览文件（图片/文本/PDF/视频/音频） |
| `DELETE` | `/api/files/{id}` | 按 ID 删除文件 |

```bash
# 获取文件列表
curl $BASE/api/files

# 上传文件（字段名必须是 files，复数）
curl -X POST $BASE/api/files/upload \
  -F "files=@myfile.txt"

# 下载（需要先获取文件 ID）
curl $BASE/api/files/{id}/download -O -J
```

---

## Gradle 缓存 API（`/api/gradle-cache`）

> 供 CI 构建脚本使用的 key-value 缓存存取接口。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/gradle-cache` | 列出所有缓存 key |
| `GET` | `/api/gradle-cache/{key}` | 下载缓存包 |
| `PUT` | `/api/gradle-cache/{key}` | 上传缓存包（流式，支持大文件） |
| `GET` | `/api/gradle-cache/{key}/exists` | 检查 key 是否存在 |
| `DELETE` | `/api/gradle-cache/{key}` | 删除缓存 key |

---

## 项目结构

```
PyFileService/
├── main.py              # FastAPI 入口，路由注册
├── config.py            # 配置（上传目录、DB路径、FS_API_KEY、FS_BASE_DIR）
├── database.py          # SQLite 数据库初始化
├── models.py            # SQLAlchemy 数据模型
├── requirements.txt     # 依赖列表
├── routers/
│   ├── files.py         # 文件管理 API
│   ├── filesystem.py    # 文件系统 API（路径操作）
│   ├── gradle_cache.py  # Gradle 缓存 API
│   └── storage.py       # 存储统计 API
├── services/
│   └── file_service.py  # 文件管理业务逻辑
├── uploads/             # 文件管理 API 的存储目录（gitignore）
├── gradle_cache/        # Gradle 缓存存储目录（gitignore）
└── static/              # 前端静态资源
```

---

## 常见问题

**Q: 401 Unauthorized**  
文件系统 API 未携带或 Key 错误，检查 `X-API-Key` Header。

**Q: 400 路径越界**  
`FS_BASE_DIR` 不为 `/` 时，请求路径不在允许范围内。

**Q: 403 权限不足**  
服务进程用户无权访问该路径，换个有权限的路径。

**Q: 服务重启后消失**  
服务为手动启动，进程重启后需重新执行启动命令。建议配置 systemd/supervisor 实现自动拉起。

**Q: 上传报 422 Unprocessable Entity**  
字段名必须是 `files`（复数），不能用 `file`（单数）。
