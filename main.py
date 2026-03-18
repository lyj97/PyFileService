from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import init_db
from routers import files, storage
import os

app = FastAPI(title="PyFileService", description="文件上传下载管理服务")

# 初始化数据库表
init_db()

# 注册 API 路由
app.include_router(files.router)
app.include_router(storage.router)

# 挂载静态资源目录
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
def index():
    """返回前端主页"""
    return FileResponse(os.path.join(static_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
