from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from urllib.parse import urlparse
import shutil
import os
import traceback
import requests

from analyzer import analyze_audio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class AnalyzeUrlRequest(BaseModel):
    url: str


@app.get("/")
def home():
    return {"message": "SoundAudit backend is running"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    try:
        safe_filename = file.filename.replace(" ", "_")
        file_path = os.path.join(UPLOAD_DIR, safe_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = analyze_audio(file_path)
        return result

    except Exception as e:
        print("ERROR IN /analyze:")
        traceback.print_exc()
        return {
            "error": str(e),
            "message": "Something failed while analyzing the uploaded file."
        }


@app.post("/analyze-url")
async def analyze_url(request: AnalyzeUrlRequest):
    try:
        media_url = request.url

        parsed_url = urlparse(media_url)

        if parsed_url.scheme not in ["http", "https"]:
            return {
                "error": f"Unsupported URL scheme: {parsed_url.scheme}",
                "message": "Only http:// or https:// media URLs can be analyzed by /analyze-url. Use the upload page for local files."
            }

        file_name = os.path.basename(parsed_url.path)

        if not file_name:
            file_name = "page-media.mp4"

        safe_filename = file_name.replace(" ", "_")
        file_path = os.path.join(UPLOAD_DIR, safe_filename)

        headers = {
            "User-Agent": "Mozilla/5.0"
        }

        with requests.get(media_url, headers=headers, stream=True, timeout=60) as response:
            response.raise_for_status()

            with open(file_path, "wb") as buffer:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        buffer.write(chunk)

        result = analyze_audio(file_path)
        return result

    except Exception as e:
        print("ERROR IN /analyze-url:")
        traceback.print_exc()
        return {
            "error": str(e),
            "message": "Something failed while analyzing the media URL."
        }