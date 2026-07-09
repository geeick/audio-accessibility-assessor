# SoundAudit

SoundAudit is an audio accessibility auditing tool for hard-of-hearing users and content creators. It analyzes audio or video files and generates a report that highlights issues such as background noise, fast speech, possible transcription errors, language detection problems, and unclear sections.

The goal is not just to generate captions. SoundAudit helps creators understand whether their audio is actually easy to follow.

## Problem

Captions are helpful, but they do not always tell the full story. A video may technically have captions while still being difficult for hard-of-hearing users because of:

- background noise
- fast speech
- music under dialogue
- unclear pronunciation
- low volume
- language switches
- bad automatic transcription
- long caption chunks with no breaks

SoundAudit gives creators a clearer accessibility report so they know what to fix.

## Features

### Web App

- Upload an audio or video file
- Generate an overall accessibility score
- Detect spoken language
- Estimate speech speed in words per minute
- Estimate background noise level
- Generate warnings and recommendations
- Show an accessibility issues timeline
- Highlight problematic transcript sections
- Hover over highlighted transcript sections to see the issue
- Download the report

### Chrome Extension Prototype

- Scans the current webpage for direct `<video>` or `<audio>` media files
- Lets the user choose a detected media file
- Sends the media URL to the SoundAudit backend
- Shows a quick report in the extension popup
- Opens a full report page with transcript highlights and issue details
- Saves/downloads the report

The extension works best on pages with direct media files such as `.mp4`, `.webm`, `.mp3`, or `.wav`. It may not work on sites that use streaming, `blob:` URLs, DRM, or private media sources.

## Tech Stack

### Backend

- Python
- FastAPI
- Uvicorn
- Whisper for transcription
- librosa for audio analysis
- langdetect for language detection
- ffmpeg for audio/video processing

### Frontend

- HTML
- CSS
- JavaScript

### Browser Extension

- Chrome Extension Manifest V3
- JavaScript
- Chrome scripting and storage APIs

## Project Structure

```txt
AudioAccesibility/
  backend/
    main.py
    analyzer.py
    requirements.txt

  frontend/
    index.html
    app.js
    style.css

  extension/
    manifest.json
    popup.html
    popup.js
    report.html
    report.js
    style.css

  test-video-bad-audio.html
  test-video-good-audio.html
  soundaudit_bad_audio_extension_test.mp4
```

## How to Run Locally

### 1. Install backend dependencies

Go to the backend folder:

```powershell
cd backend
pip install -r requirements.txt
```

If needed, install `requests`:

```powershell
pip install requests
```

You also need `ffmpeg` installed and available on PATH.

On Windows, if ffmpeg is installed but not on PATH, temporarily add it in PowerShell:

```powershell
$env:Path += ";C:\Users\info\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin"
```

Check that it works:

```powershell
ffmpeg -version
```

### 2. Run the backend

From the `backend` folder:

```powershell
python -m uvicorn main:app --reload
```

The backend should run at:

```txt
http://127.0.0.1:8000
```

You can test the API docs at:

```txt
http://127.0.0.1:8000/docs
```

### 3. Run the frontend

Open a second terminal:

```powershell
cd frontend
python -m http.server 5500
```

Then open:

```txt
http://localhost:5500
```

Upload an audio or video file and click **Analyze Audio**.

## How to Test the Chrome Extension

### 1. Start the backend

```powershell
cd backend
python -m uvicorn main:app --reload
```

### 2. Start a local server for the test video page

From the root project folder:

```powershell
python -m http.server 5501
```

Then open:

```txt
http://localhost:5501/test-video-bad-audio.html
```

Important: open the page using `http://localhost:5501`, not `file:///`.

### 3. Load the extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` folder.
6. Open the test video page.
7. Click the SoundAudit extension.
8. Click **Find media on page**.
9. Click **Analyze this media**.
10. Open the full analysis report.

## API Endpoints

### `POST /analyze`

Analyzes an uploaded audio or video file.

Input:

```txt
multipart/form-data
file: audio/video file
```

Example response:

```json
{
  "overall_score": 70,
  "languages": [
    {
      "language_code": "en",
      "language_name": "English",
      "percentage": 100
    }
  ],
  "speech_speed_wpm": 114,
  "background_noise": "medium",
  "transcript": "...",
  "transcript_segments": [],
  "warnings": [],
  "recommendations": [],
  "issues": []
}
```

### `POST /analyze-url`

Analyzes a media file from a URL found on a webpage.

Input:

```json
{
  "url": "http://localhost:5501/soundaudit_bad_audio_extension_test.mp4"
}
```

Returns the same report structure as `/analyze`.

## Accessibility Score

SoundAudit starts with a score of 100 and subtracts points for detected accessibility issues.

Examples of score penalties include:

- medium or high background noise
- fast speech
- multiple detected languages
- possible transcription errors
- unclear sections
- long caption chunks

The score gives creators a quick sense of how accessible the audio is, but it should not replace manual accessibility review.

## Example Issues

SoundAudit can flag issues like:

```txt
Background noise
Full audio
Background noise appears moderate.

Fast speech
00:14 - 00:17
This section is very fast at about 250 words per minute.

Possible transcription error
00:42 - 00:47
This section may contain unclear speech or a language shift that was not transcribed accurately.
```

## Limitations

- Whisper transcription can be inaccurate, especially with noisy or synthetic audio.
- Language detection depends on transcript quality.
- The Chrome extension can only analyze direct media URLs.
- Streaming sites may expose `blob:` URLs, which cannot be downloaded directly by the backend.
- The current background noise detection is a basic estimate.
- The progress bar is simulated rather than a true backend progress stream.

## Future Improvements

- Add real sound event detection such as laughter, applause, alarms, and music
- Add better local volume and clipping detection
- Add speaker separation
- Add support for caption files such as `.srt` and `.vtt`
- Add a creator checklist for fixing accessibility issues
- Add PDF export
- Add deployment for the backend
- Add optional tab audio capture for streaming websites
- Improve multilingual detection using a stronger model

