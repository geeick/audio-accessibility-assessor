const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const analyzeBtn = document.getElementById("analyzeBtn");
const loadingCard = document.getElementById("loadingCard");
const resultsSection = document.getElementById("results");
const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");
const loadingStage = document.getElementById("loadingStage");

let progressTimer = null;
let latestReport = null;
let fakeProgress = 0;

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileName.textContent = file ? file.name : "No file chosen";
});

function startLoadingUI() {
  fakeProgress = 0;
  updateProgress(0, "Preparing upload...");
  loadingCard.classList.remove("hidden");
  resultsSection.classList.add("hidden");
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  progressTimer = setInterval(() => {
    if (fakeProgress < 20) {
      fakeProgress += 4;
      updateProgress(fakeProgress, "Uploading file...");
    } else if (fakeProgress < 45) {
      fakeProgress += 3;
      updateProgress(fakeProgress, "Transcribing audio...");
    } else if (fakeProgress < 70) {
      fakeProgress += 2;
      updateProgress(fakeProgress, "Detecting languages...");
    } else if (fakeProgress < 90) {
      fakeProgress += 1;
      updateProgress(fakeProgress, "Scoring accessibility...");
    } else if (fakeProgress < 96) {
      fakeProgress += 0.5;
      updateProgress(Math.floor(fakeProgress), "Finalizing report...");
    }
  }, 220);
}

function fillInteractiveTranscript(segments, fallbackTranscript) {
  const transcript = document.getElementById("transcript");
  transcript.innerHTML = "";

  if (!segments.length) {
    transcript.textContent = fallbackTranscript || "No transcript available.";
    return;
  }

  segments.forEach((segment) => {
    const span = document.createElement("span");

    span.className = `transcript-segment ${segment.severity || "none"}`;
    span.textContent = segment.text + " ";

    const issues = segment.issues || [];

    if (issues.length > 0) {
      const tooltipText = issues
        .map((issue) => {
          return `${issue.type} (${issue.severity})\n${issue.message}\nTime: ${issue.time}`;
        })
        .join("\n\n");

      span.dataset.tooltip = tooltipText;
      span.setAttribute("tabindex", "0");

      span.addEventListener("mouseenter", showFloatingTooltip);
      span.addEventListener("mousemove", moveFloatingTooltip);
      span.addEventListener("mouseleave", hideFloatingTooltip);

      span.addEventListener("focus", showFloatingTooltip);
      span.addEventListener("blur", hideFloatingTooltip);
    }

    transcript.appendChild(span);
  });
}

function showFloatingTooltip(event) {
  const tooltip = document.getElementById("floatingTooltip");
  tooltip.textContent = event.currentTarget.dataset.tooltip;
  tooltip.classList.remove("hidden");
  moveFloatingTooltip(event);
}

function moveFloatingTooltip(event) {
  const tooltip = document.getElementById("floatingTooltip");

  const padding = 16;
  const offsetX = 18;
  const offsetY = 18;

  let x = event.clientX + offsetX;
  let y = event.clientY + offsetY;

  const rect = tooltip.getBoundingClientRect();

  if (x + rect.width > window.innerWidth - padding) {
    x = event.clientX - rect.width - offsetX;
  }

  if (y + rect.height > window.innerHeight - padding) {
    y = event.clientY - rect.height - offsetY;
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideFloatingTooltip() {
  const tooltip = document.getElementById("floatingTooltip");
  tooltip.classList.add("hidden");
}

function stopLoadingUI() {
  clearInterval(progressTimer);
  updateProgress(100, "Analysis complete.");
  setTimeout(() => {
    loadingCard.classList.add("hidden");
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Audio";
  }, 400);
}

function updateProgress(value, stageText) {
  const rounded = Math.min(100, Math.floor(value));
  progressBar.style.width = `${rounded}%`;
  progressPercent.textContent = `${rounded}%`;
  loadingStage.textContent = stageText;
}

async function uploadFile() {
  const file = fileInput.files[0];

  if (!file) {
    alert("Please choose an audio or video file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  startLoadingUI();

  try {
    const response = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "Analysis failed.");
    }

    fillResults(data);
    stopLoadingUI();

    setTimeout(() => {
      resultsSection.classList.remove("hidden");
    }, 450);
  } catch (error) {
    clearInterval(progressTimer);
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Audio";
    loadingCard.classList.add("hidden");

    alert("Something went wrong: " + error.message);
    console.error(error);
  }
}

function fillResults(data) {
  const score = data.overall_score ?? 0;
  const languages = data.languages ?? [];
  const warnings = data.warnings ?? [];
  const recommendations = data.recommendations ?? [];
  latestReport = data;

  document.getElementById("scoreValue").textContent = score;
  document.getElementById("speechSpeed").textContent = data.speech_speed_wpm ?? "--";
  document.getElementById("backgroundNoise").textContent = capitalize(data.background_noise ?? "--");
  document.getElementById("languageCount").textContent = languages.length;

  setScoreRing(score);
  setScoreSummary(score, warnings);
  setReportStatus(score);

  fillLanguageChips(languages);
  fillList("warnings", warnings);
  fillIssuesTimeline(data.issues ?? []);
  fillList("recommendations", recommendations);
  fillInteractiveTranscript(data.transcript_segments ?? [], data.transcript ?? "");

}

function fillIssuesTimeline(issues) {
  const timeline = document.getElementById("issuesTimeline");
  timeline.innerHTML = "";

  if (!issues.length) {
    timeline.innerHTML = "<p>No issue data available.</p>";
    return;
  }

  issues.forEach((issue) => {
    const item = document.createElement("div");
    item.className = "timeline-item";

    const severityClass = issue.severity
      ? issue.severity.toLowerCase()
      : "low";

    item.innerHTML = `
      <div class="timeline-dot ${severityClass}"></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <strong>${issue.type}</strong>
          <span>${issue.time}</span>
        </div>
        <p>${issue.message}</p>
        <span class="severity-pill ${severityClass}">${issue.severity}</span>
      </div>
    `;

    timeline.appendChild(item);
  });
}

function setScoreRing(score) {
  const scoreRing = document.getElementById("scoreRing");
  const degrees = Math.round((score / 100) * 360);

  let color = "#ef4444";
  if (score >= 80) color = "#00b884";
  else if (score >= 60) color = "#f59e0b";

  scoreRing.style.background = `conic-gradient(${color} ${degrees}deg, #dfe8fb ${degrees}deg)`;
}

function setScoreSummary(score, warnings) {
  const scoreSummary = document.getElementById("scoreSummary");

  if (score >= 85) {
    scoreSummary.textContent = "This file appears highly accessible with few major issues.";
  } else if (score >= 70) {
    scoreSummary.textContent = "This file is fairly accessible, but there are some improvements worth making.";
  } else if (score >= 50) {
    scoreSummary.textContent = "This file has moderate accessibility issues that should be reviewed.";
  } else {
    scoreSummary.textContent = "This file may be difficult for hard-of-hearing users to follow.";
  }

  if (warnings.length === 1 && warnings[0].includes("No major")) {
    scoreSummary.textContent = "This file appears highly accessible with no major issues detected.";
  }
}

function setReportStatus(score) {
  const reportStatus = document.getElementById("reportStatus");

  if (score >= 85) reportStatus.textContent = "Strong";
  else if (score >= 70) reportStatus.textContent = "Good";
  else if (score >= 50) reportStatus.textContent = "Needs Review";
  else reportStatus.textContent = "Needs Work";
}

function fillLanguageChips(languages) {
  const container = document.getElementById("languages");
  container.innerHTML = "";

  if (!languages.length) {
    const chip = document.createElement("div");
    chip.className = "language-chip";
    chip.textContent = "No language data";
    container.appendChild(chip);
    return;
  }

  languages.forEach((lang) => {
    const chip = document.createElement("div");
    chip.className = "language-chip";

    const name =
      lang.language_name ||
      lang.language_code ||
      "Unknown";

    const percentage =
      lang.percentage !== undefined ? ` (${lang.percentage}%)` : "";

    chip.textContent = `${name}${percentage}`;
    container.appendChild(chip);
  });
}

function fillList(id, items) {
  const list = document.getElementById(id);
  list.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "None";
    list.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
}

function capitalize(value) {
  if (!value || typeof value !== "string") return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function downloadReport() {
  if (!latestReport) {
    alert("No report available yet.");
    return;
  }

  const reportText = `
SoundAudit Accessibility Report

Overall Score: ${latestReport.overall_score}/100
Speech Speed: ${latestReport.speech_speed_wpm} WPM
Background Noise: ${latestReport.background_noise}

Languages:
${(latestReport.languages || []).map(lang => `- ${lang.language_name || lang.language_code}: ${lang.percentage}%`).join("\n")}

Warnings:
${(latestReport.warnings || []).map(w => `- ${w}`).join("\n")}

Recommendations:
${(latestReport.recommendations || []).map(r => `- ${r}`).join("\n")}

Transcript:
${latestReport.transcript}
`;

  const blob = new Blob([reportText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "soundaudit-report.txt";
  a.click();

  URL.revokeObjectURL(url);
}