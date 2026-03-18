from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime
from database import Base


class FileRecord(Base):
    """文件记录表"""
    __tablename__ = "files"

    # 文件唯一标识（UUID）
    id = Column(String(36), primary_key=True, index=True)
    # 用户上传的原始文件名
    original_name = Column(String(255), nullable=False)
    # 磁盘上的存储文件名（UUID + 原始后缀，防冲突）
    stored_name = Column(String(255), nullable=False, unique=True)
    # MIME 类型（用于预览类型判断）
    mime_type = Column(String(128), nullable=True)
    # 文件大小（字节）
    size = Column(Integer, nullable=False)
    # 上传时间
    upload_time = Column(DateTime, default=datetime.utcnow, nullable=False)
