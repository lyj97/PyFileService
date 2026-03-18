from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services import file_service

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("/stats")
def get_storage_stats(db: Session = Depends(get_db)):
    """获取存储用量统计"""
    stats = file_service.get_storage_stats(db)
    return stats
