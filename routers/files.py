import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from services import file_service
from config import MAX_FILE_SIZE

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("")
def list_files(
    search: str = Query(default="", description="搜索关键词"),
    sort_by: str = Query(default="upload_time", description="排序字段：upload_time / original_name / size"),
    order: str = Query(default="desc", description="排序方向：asc / desc"),
    db: Session = Depends(get_db),
):
    """获取文件列表"""
    records = file_service.get_file_list(db, search=search, sort_by=sort_by, order=order)
    return [
        {
            "id": r.id,
            "original_name": r.original_name,
            "mime_type": r.mime_type,
            "size": r.size,
            "upload_time": r.upload_time.isoformat() if r.upload_time else None,
        }
        for r in records
    ]


@router.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """批量上传文件"""
    results = []
    for upload_file in files:
        # 读取文件内容以检查大小（先 seek 回 0）
        content = await upload_file.read()
        if len(content) > MAX_FILE_SIZE:
            results.append({
                "original_name": upload_file.filename,
                "success": False,
                "error": f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）",
            })
            continue

        # 重置指针以便再次读取
        await upload_file.seek(0)

        try:
            record = await file_service.save_uploaded_file(db, upload_file)
            results.append({
                "id": record.id,
                "original_name": record.original_name,
                "size": record.size,
                "mime_type": record.mime_type,
                "upload_time": record.upload_time.isoformat(),
                "success": True,
            })
        except Exception as e:
            results.append({
                "original_name": upload_file.filename,
                "success": False,
                "error": str(e),
            })

    return results


@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db)):
    """下载文件"""
    record = file_service.get_file_by_id(db, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="文件不存在")

    file_path = file_service.get_file_path(record)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件已从磁盘删除")

    return FileResponse(
        path=file_path,
        filename=record.original_name,
        media_type=record.mime_type or "application/octet-stream",
    )


@router.get("/{file_id}/preview")
def preview_file(file_id: str, db: Session = Depends(get_db)):
    """
    预览文件：返回文件内容流
    对于图片、文本、PDF、音视频直接流式返回；其他类型返回 406
    """
    record = file_service.get_file_by_id(db, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="文件不存在")

    file_path = file_service.get_file_path(record)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件已从磁盘删除")

    mime = record.mime_type or "application/octet-stream"

    # 文本类：直接读取返回
    if mime.startswith("text/") or mime in ("application/json", "application/xml"):
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {"type": "text", "content": content, "mime_type": mime}

    # 图片、PDF、音视频：流式返回
    previewable = (
        mime.startswith("image/")
        or mime == "application/pdf"
        or mime.startswith("video/")
        or mime.startswith("audio/")
    )
    if previewable:
        def iter_file():
            with open(file_path, "rb") as f:
                while chunk := f.read(1024 * 1024):
                    yield chunk

        return StreamingResponse(iter_file(), media_type=mime)

    # 其他类型不支持预览
    raise HTTPException(status_code=406, detail="该文件类型不支持预览")


@router.delete("/{file_id}")
def delete_file(file_id: str, db: Session = Depends(get_db)):
    """删除文件"""
    success = file_service.delete_file(db, file_id)
    if not success:
        raise HTTPException(status_code=404, detail="文件不存在")
    return {"message": "删除成功"}
