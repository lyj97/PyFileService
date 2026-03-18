import os

# 上传文件存储目录
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")

# SQLite 数据库路径
DATABASE_URL = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'fileservice.db')}"

# 单文件最大上传大小（字节），默认 100MB
MAX_FILE_SIZE = 1000 * 1024 * 1024

# 确保上传目录存在
os.makedirs(UPLOAD_DIR, exist_ok=True)
