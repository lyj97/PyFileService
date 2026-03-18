from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import DATABASE_URL

# 创建 SQLite 引擎，check_same_thread=False 支持多线程访问
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# 会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ORM 基类
Base = declarative_base()


def get_db():
    """FastAPI 依赖注入：获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库，创建所有表"""
    from models import FileRecord  # 确保模型被导入
    Base.metadata.create_all(bind=engine)
