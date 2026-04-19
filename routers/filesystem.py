"""
文件系统 API 路由

提供基于路径的文件系统操作接口，支持任意路径（BASE_DIR 默认 /）。
所有接口需要 API Key 认证（Header: X-API-Key）。

接口列表：
  POST   /api/fs/upload    上传文件到指定路径
  GET    /api/fs/download  下载指定路径的文件
  GET    /api/fs/ls        列出指定目录内容
  POST   /api/fs/mv        移动/重命名文件或目录
  DELETE /api/fs/delete    删除文件或目录
"""

import os
import shutil
import stat
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Security, UploadFile
from fastapi.responses import FileResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

from config import FS_API_KEY, FS_BASE_DIR

router = APIRouter(prefix="/api/fs", tags=["filesystem"])

# ── 认证 ──────────────────────────────────────────────────────────────────────

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(key: Optional[str] = Security(api_key_header)):
    if key != FS_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key (Header: X-API-Key)")
    return key


# ── 路径安全检查 ───────────────────────────────────────────────────────────────

def safe_resolve(path: str) -> str:
    """
    将用户传入的 path 解析为绝对路径，并验证是否在 FS_BASE_DIR 内。
    BASE_DIR 为 "/" 时等同于无限制。
    """
    base = os.path.realpath(FS_BASE_DIR)
    # 支持绝对路径和相对路径（相对于 BASE_DIR）
    if not os.path.isabs(path):
        resolved = os.path.realpath(os.path.join(base, path))
    else:
        resolved = os.path.realpath(path)

    if base != "/" and not resolved.startswith(base):
        raise HTTPException(
            status_code=400,
            detail=f"路径越界：{path!r} 不在允许的根目录 {base!r} 内"
        )
    return resolved


# ── 接口实现 ───────────────────────────────────────────────────────────────────

@router.post("/upload", summary="上传文件到指定路径")
async def upload_files(
    path: str = Query(..., description="目标目录路径（绝对路径或相对于BASE_DIR）"),
    files: List[UploadFile] = File(...),
    _: str = Depends(verify_api_key),
):
    """上传一个或多个文件到指定目录，目录不存在时自动创建。"""
    target_dir = safe_resolve(path)

    # 目标必须是目录（或不存在）
    if os.path.exists(target_dir) and not os.path.isdir(target_dir):
        raise HTTPException(status_code=400, detail=f"{path!r} 已存在且不是目录")

    os.makedirs(target_dir, exist_ok=True)

    results = []
    for upload_file in files:
        dest = os.path.join(target_dir, os.path.basename(upload_file.filename or "upload"))
        try:
            with open(dest, "wb") as f:
                content = await upload_file.read()
                f.write(content)
            results.append({
                "filename": upload_file.filename,
                "saved_to": dest,
                "size": len(content),
                "success": True,
            })
        except Exception as e:
            results.append({
                "filename": upload_file.filename,
                "success": False,
                "error": str(e),
            })

    return {"uploaded": len([r for r in results if r["success"]]), "results": results}


@router.get("/download", summary="下载指定路径的文件")
def download_file(
    path: str = Query(..., description="文件路径（绝对路径或相对于BASE_DIR）"),
    _: str = Depends(verify_api_key),
):
    """下载指定路径的文件。"""
    resolved = safe_resolve(path)

    if not os.path.exists(resolved):
        raise HTTPException(status_code=404, detail=f"文件不存在：{path!r}")
    if not os.path.isfile(resolved):
        raise HTTPException(status_code=400, detail=f"{path!r} 不是文件")

    return FileResponse(
        path=resolved,
        filename=os.path.basename(resolved),
        media_type="application/octet-stream",
    )


@router.get("/ls", summary="列出目录内容")
def list_directory(
    path: str = Query(default="/", description="目录路径（绝对路径或相对于BASE_DIR）"),
    _: str = Depends(verify_api_key),
):
    """列出指定目录下的文件和子目录，返回名称、类型、大小、修改时间。"""
    resolved = safe_resolve(path)

    if not os.path.exists(resolved):
        raise HTTPException(status_code=404, detail=f"路径不存在：{path!r}")
    if not os.path.isdir(resolved):
        raise HTTPException(status_code=400, detail=f"{path!r} 不是目录")

    entries = []
    try:
        for name in sorted(os.listdir(resolved)):
            full = os.path.join(resolved, name)
            try:
                st = os.stat(full)
                is_dir = stat.S_ISDIR(st.st_mode)
                entries.append({
                    "name": name,
                    "type": "dir" if is_dir else "file",
                    "size": st.st_size if not is_dir else None,
                    "mtime": datetime.fromtimestamp(st.st_mtime).isoformat(),
                    "path": full,
                })
            except OSError:
                entries.append({"name": name, "type": "unknown", "error": "stat failed"})
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"权限不足：{e}")

    return {
        "path": resolved,
        "count": len(entries),
        "entries": entries,
    }


class MvRequest(BaseModel):
    src: str
    dst: str


@router.post("/mv", summary="移动或重命名文件/目录")
def move_file(
    body: MvRequest,
    _: str = Depends(verify_api_key),
):
    """移动或重命名文件/目录。src 和 dst 均支持绝对路径或相对于BASE_DIR的路径。"""
    src = safe_resolve(body.src)
    dst = safe_resolve(body.dst)

    if not os.path.exists(src):
        raise HTTPException(status_code=404, detail=f"源路径不存在：{body.src!r}")
    if os.path.exists(dst):
        raise HTTPException(status_code=409, detail=f"目标路径已存在：{body.dst!r}")

    # 确保目标父目录存在
    os.makedirs(os.path.dirname(dst), exist_ok=True)

    try:
        shutil.move(src, dst)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"移动失败：{e}")

    return {"src": src, "dst": dst, "message": "移动成功"}


@router.delete("/delete", summary="删除文件或目录")
def delete_path(
    path: str = Query(..., description="要删除的文件或目录路径"),
    _: str = Depends(verify_api_key),
):
    """删除文件或目录（目录递归删除）。"""
    resolved = safe_resolve(path)

    if not os.path.exists(resolved):
        raise HTTPException(status_code=404, detail=f"路径不存在：{path!r}")

    try:
        if os.path.isfile(resolved) or os.path.islink(resolved):
            os.remove(resolved)
            kind = "文件"
        else:
            shutil.rmtree(resolved)
            kind = "目录"
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"权限不足：{e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败：{e}")

    return {"path": resolved, "message": f"{kind}已删除"}
