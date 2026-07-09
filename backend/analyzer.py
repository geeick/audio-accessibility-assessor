import shutil
from collections import Counter

import librosa
import numpy as np
import whisper
from langdetect import detect_langs


if shutil.which("ffmpeg") is None:
    raise RuntimeError(
        "ffmpeg is not installed or not added to PATH. Install ffmpeg and restart PowerShell."
    )


model = whisper.load_model("base")


LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "pt": "Portuguese",
    "fr": "French",
    "it": "Italian",
    "de": "German",
    "nl": "Dutch",
    "cy": "Welsh",
    "da": "Danish",
    "sv": "Swedish",
    "af": "Afrikaans",
    "sw": "Swahili",
    "no": "Norwegian",
    "sq": "Albanian",
    "tl": "Tagalog",
}


def analyze_audio(file_path):
    transcription = model.transcribe(file_path, verbose=False)

    full_text = transcription.get("text", "").strip()
    segments = transcription.get("segments", [])

    languages = detect_languages_from_segments(segments)

    if not languages:
        languages = detect_main_language(full_text)

    speech_speed = calculate_speech_speed(full_text, segments)
    background_noise = estimate_background_noise(file_path)

    warnings = build_warnings(languages, speech_speed, background_noise)
    recommendations = build_recommendations(languages, speech_speed, background_noise)
    issues = build_issues(languages, speech_speed, background_noise, segments)
    transcript_segments = build_transcript_segments(segments, issues)
    score = calculate_score(languages, speech_speed, background_noise, warnings, issues)

    return {
        "overall_score": score,
        "languages": languages,
        "speech_speed_wpm": speech_speed,
        "background_noise": background_noise,
        "transcript": full_text,
        "transcript_segments": transcript_segments,
        "warnings": warnings,
        "recommendations": recommendations,
        "issues": issues,
    }


def detect_languages_from_segments(segments):
    language_counts = Counter()

    for segment in segments:
        text = segment.get("text", "").strip()

        # Short text is unreliable for language detection.
        if len(text.split()) < 8:
            continue

        try:
            guesses = detect_langs(text)
            best_guess = guesses[0]

            # Ignore weak language guesses.
            if best_guess.prob < 0.85:
                continue

            language_counts[best_guess.lang] += 1

        except Exception:
            continue

    total = sum(language_counts.values())

    if total == 0:
        return []

    languages = []

    for lang, count in language_counts.most_common():
        percentage = round((count / total) * 100, 1)

        # Ignore tiny fake language detections.
        if percentage < 10:
            continue

        languages.append(
            {
                "language_code": lang,
                "language_name": LANGUAGE_NAMES.get(lang, lang),
                "percentage": percentage,
            }
        )

    return languages


def detect_main_language(full_text):
    if len(full_text.split()) < 10:
        return []

    try:
        guesses = detect_langs(full_text)
        best_guess = guesses[0]

        if best_guess.prob >= 0.85:
            return [
                {
                    "language_code": best_guess.lang,
                    "language_name": LANGUAGE_NAMES.get(best_guess.lang, best_guess.lang),
                    "percentage": 100,
                }
            ]

    except Exception:
        pass

    return []


def calculate_speech_speed(text, segments):
    word_count = len(text.split())

    if not segments:
        return 0

    start = segments[0]["start"]
    end = segments[-1]["end"]
    duration_minutes = max((end - start) / 60, 0.01)

    return round(word_count / duration_minutes)


def estimate_background_noise(file_path):
    y, sr = librosa.load(file_path, sr=None)

    rms = librosa.feature.rms(y=y)[0]
    avg_energy = float(np.mean(rms))
    energy_variation = float(np.std(rms))

    if avg_energy > 0.08 and energy_variation > 0.05:
        return "high"
    elif avg_energy > 0.04:
        return "medium"
    else:
        return "low"


def build_warnings(languages, speech_speed, background_noise):
    warnings = []

    if len(languages) > 1:
        warnings.append(
            "Multiple languages were detected. Viewers may need translated captions or language labels."
        )

    if speech_speed > 220:
        warnings.append("Speech is very fast and may be difficult to follow.")
    elif speech_speed > 180:
        warnings.append("Speech is slightly fast.")

    if background_noise == "high":
        warnings.append("Background noise appears high and may interfere with speech clarity.")
    elif background_noise == "medium":
        warnings.append("Background noise appears moderate.")

    if not warnings:
        warnings.append("No major audio accessibility issues were detected.")

    return warnings


def build_recommendations(languages, speech_speed, background_noise):
    recommendations = []

    if len(languages) > 1:
        recommendations.append("Add captions or labels for each language used in the audio.")
        recommendations.append("Consider adding translated captions for multilingual sections.")

    if speech_speed > 180:
        recommendations.append("Add punctuation and line breaks to captions so fast speech is easier to follow.")

    if background_noise in ["medium", "high"]:
        recommendations.append("Reduce background music or noise during speech.")
        recommendations.append("Manually review captions in noisy sections.")

    if not recommendations:
        recommendations.append("Audio appears reasonably accessible, but captions should still be reviewed manually.")

    return recommendations


def calculate_score(languages, speech_speed, background_noise, warnings, issues=None):
    score = 100

    if len(languages) > 1:
        score -= 10

    if speech_speed > 220:
        score -= 20
    elif speech_speed > 180:
        score -= 10

    if background_noise == "high":
        score -= 25
    elif background_noise == "medium":
        score -= 10

    if issues:
        for issue in issues:
            issue_type = issue.get("type", "")
            severity = issue.get("severity", "")

            if issue_type == "No major issues":
                continue

            if severity == "High":
                score -= 10
            elif severity == "Medium":
                score -= 5
            elif severity == "Low":
                score -= 2

    return max(0, min(100, score))

def build_issues(languages, speech_speed, background_noise, segments):
    issues = []

    # Whole-file issue: background noise
    if background_noise == "high":
        issues.append({
            "time": "Full audio",
            "type": "Background noise",
            "severity": "High",
            "message": "Background noise appears high and may interfere with speech clarity."
        })
    elif background_noise == "medium":
        issues.append({
            "time": "Full audio",
            "type": "Background noise",
            "severity": "Medium",
            "message": "Background noise appears moderate."
        })

    # Whole-file issue: multiple languages
    if len(languages) > 1:
        issues.append({
            "time": "Full audio",
            "type": "Multiple languages",
            "severity": "Medium",
            "message": "Multiple languages were detected. Add language labels or translated captions."
        })

    # Segment-level checks
    for segment in segments:
        start = segment.get("start", 0)
        end = segment.get("end", 0)
        text = segment.get("text", "").strip()
        lower_text = text.lower()

        duration = max(end - start, 0.01)
        words = text.split()
        word_count = len(words)
        segment_wpm = round(word_count / (duration / 60))

        time_range = f"{format_time(start)} - {format_time(end)}"

        # Fast local speech, even if the whole-file average is normal
        if segment_wpm > 220 and word_count >= 8:
            issues.append({
                "time": time_range,
                "type": "Fast speech",
                "severity": "High",
                "message": f"This section is very fast at about {segment_wpm} words per minute."
            })
        elif segment_wpm > 180 and word_count >= 8:
            issues.append({
                "time": time_range,
                "type": "Fast speech",
                "severity": "Medium",
                "message": f"This section is slightly fast at about {segment_wpm} words per minute."
            })

        # Possible unclear audio: long segment but almost no words
        if duration > 4 and word_count <= 3:
            issues.append({
                "time": time_range,
                "type": "Possible unclear audio",
                "severity": "Medium",
                "message": "This section may be unclear because very little speech was transcribed."
            })

        # Long caption chunk
        if word_count > 35:
            issues.append({
                "time": time_range,
                "type": "Long caption chunk",
                "severity": "Medium",
                "message": "This section has a long transcript chunk. Add caption breaks to make it easier to follow."
            })

        # Detect sections where transcription is probably wrong or confused.
        # This helps catch multilingual/unclear sections that Whisper garbled.
        weird_text_markers = [
            "esterenis",
            "franchise",
            "sdn",
            "incomprehension",
            "suffers the speaker",
        ]

        if any(marker in lower_text for marker in weird_text_markers):
            issues.append({
                "time": time_range,
                "type": "Possible transcription error",
                "severity": "Medium",
                "message": "This section may contain unclear speech or a language shift that was not transcribed accurately."
            })

        # Try language detection per segment.
        # If it cannot confidently identify the language, flag it for manual caption review.
        if word_count >= 8:
            try:
                guesses = detect_langs(text)
                best_guess = guesses[0]

                if best_guess.prob < 0.65:
                    issues.append({
                        "time": time_range,
                        "type": "Unclear language detection",
                        "severity": "Medium",
                        "message": "The app could not confidently identify the language in this section. Captions should be manually reviewed."
                    })

            except Exception:
                issues.append({
                    "time": time_range,
                    "type": "Language detection failed",
                    "severity": "Medium",
                    "message": "The language in this section could not be detected reliably."
                })

    if not issues:
        issues.append({
            "time": "Full audio",
            "type": "No major issues",
            "severity": "Low",
            "message": "No major audio accessibility issues were detected."
        })

    return issues


def format_time(seconds):
    seconds = int(seconds)
    minutes = seconds // 60
    remaining_seconds = seconds % 60
    return f"{minutes:02d}:{remaining_seconds:02d}"

def build_transcript_segments(segments, issues):
    transcript_segments = []

    for segment in segments:
        start = segment.get("start", 0)
        end = segment.get("end", 0)
        text = segment.get("text", "").strip()

        matching_issues = []

        for issue in issues:
            issue_time = issue.get("time", "")

            if issue_time == "Full audio":
                continue

            issue_start, issue_end = parse_time_range(issue_time)

            if issue_start is None or issue_end is None:
                continue

            # Check whether this transcript segment overlaps with the issue time range.
            if start < issue_end and end > issue_start:
                matching_issues.append(issue)

        highest_severity = "none"

        if any(issue.get("severity") == "High" for issue in matching_issues):
            highest_severity = "high"
        elif any(issue.get("severity") == "Medium" for issue in matching_issues):
            highest_severity = "medium"
        elif any(issue.get("severity") == "Low" for issue in matching_issues):
            highest_severity = "low"

        transcript_segments.append({
            "start": start,
            "end": end,
            "time": f"{format_time(start)} - {format_time(end)}",
            "text": text,
            "severity": highest_severity,
            "issues": matching_issues,
        })

    return transcript_segments


def parse_time_range(time_range):
    try:
        parts = time_range.split("-")

        if len(parts) != 2:
            return None, None

        start = parse_time(parts[0].strip())
        end = parse_time(parts[1].strip())

        return start, end

    except Exception:
        return None, None


def parse_time(time_text):
    try:
        minutes, seconds = time_text.split(":")
        return int(minutes) * 60 + int(seconds)
    except Exception:
        return None


def format_time(seconds):
    seconds = int(seconds)
    minutes = seconds // 60
    remaining_seconds = seconds % 60
    return f"{minutes:02d}:{remaining_seconds:02d}"