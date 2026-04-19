import os
from pathlib import Path

# 自动加载项目根目录的 .env 文件（如果存在）
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

# 上传文件存储目录
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")

# 文件系统 API 配置
# BASE_DIR 设为 "/" 表示允许操作任意路径（内网私用，API Key 保护）
FS_BASE_DIR = os.environ.get("FS_BASE_DIR", "/")

# API Key 认证（通过 .env 文件或环境变量 FS_API_KEY 设置）
FS_API_KEY = os.environ.get("FS_API_KEY")
if not FS_API_KEY:
    raise RuntimeError(
        "FS_API_KEY 未设置。请在项目根目录创建 .env 文件并写入：\n"
        "  FS_API_KEY=$(python3 -c \"import secrets; print(secrets.token_hex(24))\")"
    )

# SQLite 数据库路径
DATABASE_URL = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'fileservice.db')}"

# 单文件最大上传大小（字节），默认 1GB
MAX_FILE_SIZE = 1000 * 1024 * 1024

# 确保上传目录存在
os.makedirs(UPLOAD_DIR, exist_ok=True)
