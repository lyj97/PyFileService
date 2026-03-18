import os
import uuid
import shutil
import mimetypes
from datetime import datetime
from sqlalchemy.orm import Session
from models import FileRecord
from config import UPLOAD_DIR


def get_file_list(db: Session, search: str = "", sort_by: str = "upload_time", order: str = "desc"):
    """
    获取文件列表
    :param db: 数据库会话
    :param search: 搜索关键词（匹配原始文件名）
    :param sort_by: 排序字段（upload_time / original_name / size）
    :param order: 排序方向（asc / desc）
    """
    query = db.query(FileRecord)

    # 关键词搜索
    if search:
        query = query.filter(FileRecord.original_name.ilike(f"%{search}%"))

    # 排序字段映射
    sort_column_map = {
        "upload_time": FileRecord.upload_time,
        "original_name": FileRecord.original_name,
        "size": FileRecord.size,
    }
    sort_column = sort_column_map.get(sort_by, FileRecord.upload_time)

    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    return query.all()


def get_file_by_id(db: Session, file_id: str) -> FileRecord | None:
    """根据 ID 查询文件记录"""
    return db.query(FileRecord).filter(FileRecord.id == file_id).first()


async def save_uploaded_file(db: Session, upload_file) -> FileRecord:
    """
    保存上传的文件到磁盘，并写入数据库记录
    :param db: 数据库会话
    :param upload_file: FastAPI UploadFile 对象
    :return: 创建的 FileRecord
    """
    # 获取原始文件名与后缀
    original_name = upload_file.filename or "unknown"
    ext = os.path.splitext(original_name)[1]

    # 生成唯一存储文件名
    file_id = str(uuid.uuid4())
    stored_name = f"{file_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, stored_name)

    # 逐块写入磁盘（避免大文件内存溢出）
    total_size = 0
    with open(file_path, "wb") as f:
        while True:
            chunk = await upload_file.read(1024 * 1024)  # 每次读 1MB
            if not chunk:
                break
            f.write(chunk)
            total_size += len(chunk)

    # 探测 MIME 类型
    mime_type, _ = mimetypes.guess_type(original_name)
    if not mime_type and upload_file.content_type:
        mime_type = upload_file.content_type

    # 写入数据库
    record = FileRecord(
        id=file_id,
        original_name=original_name,
        stored_name=stored_name,
        mime_type=mime_type,
        size=total_size,
        upload_time=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def delete_file(db: Session, file_id: str) -> bool:
    """
    删除文件：同步删除磁盘文件 + 数据库记录
    :return: True 成功，False 文件不存在
    """
    record = get_file_by_id(db, file_id)
    if not record:
        return False

    # 删除磁盘文件
    file_path = os.path.join(UPLOAD_DIR, record.stored_name)
    if os.path.exists(file_path):
        os.remove(file_path)

    # 删除数据库记录
    db.delete(record)
    db.commit()
    return True


def get_storage_stats(db: Session) -> dict:
    """
    统计存储用量，总量和剩余取自主机磁盘真实数据
    :return: { total, used_files, used_disk, free, file_count }
    """
    records = db.query(FileRecord).all()
    # 本服务所有文件占用的字节数（按数据库记录）
    used_files = sum(r.size for r in records)

    # 获取 uploads 目录所在磁盘的真实用量
    disk = shutil.disk_usage(UPLOAD_DIR)

    return {
        "total":      disk.total,   # 磁盘总容量
        "used":       disk.used,    # 磁盘已用（含其他程序）
        "free":       disk.free,    # 磁盘真实剩余
        "used_files": used_files,   # 本服务文件占用
        "file_count": len(records),
    }


def get_file_path(record: FileRecord) -> str:
    """获取文件在磁盘上的绝对路径"""
    return os.path.join(UPLOAD_DIR, record.stored_name)
