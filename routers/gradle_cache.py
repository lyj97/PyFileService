"""
Gradle 构建缓存路由

提供 key-value 式的缓存存取接口，供 CI 构建脚本使用。

接口：
  GET  /api/gradle-cache/{key}         下载缓存包（miss 时返回 404）
  PUT  /api/gradle-cache/{key}         上传缓存包（覆盖写入）
  GET  /api/gradle-cache/{key}/exists  检查 key 是否存在（返回 200/404）
  GET  /api/gradle-cache/             列出所有 key 及大小（运维用）
  DELETE /api/gradle-cache/{key}      手动删除某个 key（运维用）

Key 命名约定（由调用方保证）：
  gradle-stable-v1-{deps_hash}     依赖层（modules-2 + transforms-3 + wrapper）
  gradle-stable-v1-latest          依赖层最新快照（fallback 用）
  gradle-jars-v1-{jars_hash}       Plugin classpath 层（jars-9）
  gradle-jars-v1-latest            Plugin 层最新快照（fallback 用）
"""

import os
import re
import time
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter(prefix="/api/gradle-cache", tags=["gradle-cache"])

# 缓存文件存储目录（独立于普通上传目录）
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "gradle_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# key 合法字符：字母、数字、- 和 .
_KEY_RE = re.compile(r'^[a-zA-Z0-9\-\.]+$')

# 单次上传限制（默认 10GB）
MAX_UPLOAD_SIZE = 10 * 1024 * 1024 * 1024


def _key_to_path(key: str) -> str:
    """将 key 映射到磁盘文件路径"""
    if not _KEY_RE.match(key):
        raise ValueError(f"非法 key: {key!r}，只允许字母、数字、- 和 .")
    return os.path.join(CACHE_DIR, key)


# ──────────────────────────────────────────────
# GET /api/gradle-cache/
# ──────────────────────────────────────────────
@router.get("", summary="列出所有缓存 key")
def list_cache_keys():
    """列出缓存目录中所有 key 及文件大小（运维用）"""
    entries = []
    for name in sorted(os.listdir(CACHE_DIR)):
        p = os.path.join(CACHE_DIR, name)
        if os.path.isfile(p):
            stat = os.stat(p)
            entries.append({
                "key": name,
                "size_bytes": stat.st_size,
                "size_mb": round(stat.st_size / 1024 / 1024, 1),
                "mtime": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
            })
    return {"count": len(entries), "entries": entries}


# ──────────────────────────────────────────────
# GET /api/gradle-cache/{key}/exists
# ──────────────────────────────────────────────
@router.get("/{key}/exists", summary="检查 key 是否存在")
def check_cache_exists(key: str):
    """返回 200 + exists=true/false，供脚本判断是否需要上传"""
    try:
        path = _key_to_path(key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    exists = os.path.isfile(path)
    return {"key": key, "exists": exists}


# ──────────────────────────────────────────────
# GET /api/gradle-cache/{key}
# ──────────────────────────────────────────────
@router.get("/{key}", summary="下载缓存包")
def download_cache(key: str):
    """
    下载指定 key 的缓存包。
    - 命中：返回文件流（application/octet-stream）
    - 未命中：返回 404
    """
    try:
        path = _key_to_path(key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"缓存未命中: {key}")

    return FileResponse(
        path=path,
        media_type="application/octet-stream",
        filename=key,
    )


# ──────────────────────────────────────────────
# PUT /api/gradle-cache/{key}
# ──────────────────────────────────────────────
@router.put("/{key}", summary="上传缓存包")
async def upload_cache(key: str, request: Request):
    """
    上传缓存包（流式写入，支持大文件）。
    - 请求体直接为文件二进制内容（无 multipart 封装）
    - 覆盖已有 key
    """
    try:
        path = _key_to_path(key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    tmp_path = path + ".tmp"
    total_size = 0
    try:
        with open(tmp_path, "wb") as f:
            async for chunk in request.stream():
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"文件超过单次上传限制 {MAX_UPLOAD_SIZE // 1024 // 1024 // 1024}GB",
                    )
                f.write(chunk)
        # 写完后原子替换
        os.replace(tmp_path, path)
    except HTTPException:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"写入失败: {e}")

    return {
        "key": key,
        "size_bytes": total_size,
        "size_mb": round(total_size / 1024 / 1024, 1),
        "message": "上传成功",
    }


# ──────────────────────────────────────────────
# DELETE /api/gradle-cache/{key}
# ──────────────────────────────────────────────
@router.delete("/{key}", summary="删除缓存 key")
def delete_cache(key: str):
    """手动删除某个缓存 key（运维用，例如强制重建缓存时）"""
    try:
        path = _key_to_path(key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"key 不存在: {key}")

    os.remove(path)
    return {"key": key, "message": "已删除"}
