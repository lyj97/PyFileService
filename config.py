import os

# 上传文件存储目录
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")

# 文件系统 API 配置
# BASE_DIR 设为 "/" 表示允许操作任意路径（内网私用，API Key 保护）
FS_BASE_DIR = os.environ.get("FS_BASE_DIR", "/")

# API Key 认证（必须通过环境变量 FS_API_KEY 设置，不提供默认值）
FS_API_KEY = os.environ.get("FS_API_KEY")
if not FS_API_KEY:
    raise RuntimeError(
        "环境变量 FS_API_KEY 未设置。请先设置一个强随机 Key，例如：\n"
        "  export FS_API_KEY=$(python3 -c \"import secrets; print(secrets.token_hex(24))\")"
    )

# SQLite 数据库路径
DATABASE_URL = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'fileservice.db')}"

# 单文件最大上传大小（字节），默认 1GB
MAX_FILE_SIZE = 1000 * 1024 * 1024

# 确保上传目录存在
os.makedirs(UPLOAD_DIR, exist_ok=True)
