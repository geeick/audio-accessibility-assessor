const BACKEND_URL = "http://localhost:8000/analyze-url";

const scanBtn = document.getElementById("scanBtn");
const statusText = document.getElementById("status");
const mediaSection = document.getElementById("mediaSection");
const mediaList = document.getElementById("mediaList");
const loadingSection = document.getElementById("loadingSection");
const resultSection = document.getElementById("resultSection");
const progressBar = document.getElementById("progressBar");
const loadingText = document.getElementById("loadingText");
const saveBtn = document.getElementById("saveBtn");
const fullReportBtn = document.getElementById("fullReportBtn");

let latestReport = null;
let progressInterval = null;

scanBtn.addEventListener("click", scanCurrentPage);
saveBtn.addEventListener("click", saveReport);
fullReportBtn.addEventListener("click", openFullReport);

async function scanCurrentPage() {
  resetUI();
  statusText.textContent = "Scanning page...";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: findMediaOnPage
    });

    const mediaItems = results[0].result || [];

    if (mediaItems.length === 0) {
      statusText.textContent =
        "No direct video/audio file found. This page may use streaming, blob URLs, or protected media.";
      return;
    }

    statusText.textContent = `Found ${mediaItems.length} media item(s).`;
    renderMediaList(mediaItems);

  } catch (error) {
    console.error(error);
    statusText.textContent = "Error: " + error.message;
  }
}
function openFullReport() {
  chrome.tabs.create({
    url: chrome.runtime.getURL("report.html")
  });
}

function findMediaOnPage() {
  const media = [];
  const seen = new Set();

  function addMedia(url, type, label) {
    if (!url || seen.has(url)) return;

    seen.add(url);

    let blockedReason = "";

    if (url.startsWith("blob:")) {
      blockedReason = "Blob/streaming URL. This cannot be downloaded directly by the backend.";
    }

    if (url.startsWith("data:")) {
      blockedReason = "Inline data URL. This is not supported.";
    }

    media.push({
      url,
      type,
      label,
      blockedReason
    });
  }

  document.querySelectorAll("video").forEach((video, index) => {
    addMedia(video.currentSrc || video.src, "video", `Video ${index + 1}`);

    video.querySelectorAll("source").forEach((source, sourceIndex) => {
      addMedia(source.src, "video", `Video ${index + 1}, source ${sourceIndex + 1}`);
    });
  });

  document.querySelectorAll("audio").forEach((audio, index) => {
    addMedia(audio.currentSrc || audio.src, "audio", `Audio ${index + 1}`);

    audio.querySelectorAll("source").forEach((source, sourceIndex) => {
      addMedia(source.src, "audio", `Audio ${index + 1}, source ${sourceIndex + 1}`);
    });
  });

  document.querySelectorAll("a[href]").forEach((link, index) => {
    const href = link.href;
    const lower = href.toLowerCase();

    const looksLikeMedia =
      lower.endsWith(".mp4") ||
      lower.endsWith(".webm") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".mp3") ||
      lower.endsWith(".wav") ||
      lower.endsWith(".m4a") ||
      lower.endsWith(".ogg");

    if (looksLikeMedia) {
      addMedia(href, "link", link.textContent.trim() || `Media link ${index + 1}`);
    }
  });

  return media;
}

function renderMediaList(mediaItems) {
  mediaSection.classList.remove("hidden");
  mediaList.innerHTML = "";

  mediaItems.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "media-card";

    const shortUrl =
      item.url.length > 90 ? item.url.slice(0, 90) + "..." : item.url;

    const isBlocked = Boolean(item.blockedReason);

    card.innerHTML = `
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <span class="media-type">${escapeHtml(item.type)}</span>
      </div>

      <p class="url">${escapeHtml(shortUrl)}</p>

      ${
        isBlocked
          ? `<p class="warning">${escapeHtml(item.blockedReason)}</p>`
          : ""
      }

      <button class="analyze-media-btn" ${isBlocked ? "disabled" : ""}>
        Analyze this media
      </button>
    `;

    const button = card.querySelector(".analyze-media-btn");

    if (!isBlocked) {
      button.addEventListener("click", () => analyzeMediaUrl(item.url));
    }

    mediaList.appendChild(card);
  });
}

async function analyzeMediaUrl(url) {
  try {
    startLoading();

    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    const report = await response.json();

    if (!response.ok || report.error) {
      throw new Error(report.error || "Analysis failed.");
    }

    latestReport = report;
    await chrome.storage.local.set({ lastSoundAuditReport: report });

    stopLoading();
    renderReport(report);

  } catch (error) {
    console.error(error);
    stopLoading();
    statusText.textContent = "Error: " + error.message;
  }
}

function renderReport(report) {
  resultSection.classList.remove("hidden");

  document.getElementById("score").textContent = report.overall_score ?? "--";
  document.getElementById("speechSpeed").textContent = report.speech_speed_wpm ?? "--";
  document.getElementById("backgroundNoise").textContent = capitalize(report.background_noise ?? "--");
  document.getElementById("languageCount").textContent = (report.languages || []).length;

  const issuesDiv = document.getElementById("issues");
  issuesDiv.innerHTML = "";

  const issues = report.issues || [];

  if (issues.length === 0) {
    issuesDiv.textContent = "No issues found.";
    return;
  }

  issues.forEach((issue) => {
    const issueCard = document.createElement("div");
    issueCard.className = "issue-card";

    issueCard.innerHTML = `
      <div class="issue-header">
        <strong>${escapeHtml(issue.type)}</strong>
        <span>${escapeHtml(issue.time)}</span>
      </div>
      <p>${escapeHtml(issue.message)}</p>
      <em class="${escapeHtml((issue.severity || "").toLowerCase())}">
        ${escapeHtml(issue.severity)}
      </em>
    `;

    issuesDiv.appendChild(issueCard);
  });
}

function saveReport() {
  if (!latestReport) {
    alert("No report available yet.");
    return;
  }

  const text = JSON.stringify(latestReport, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "soundaudit-report.json";
  a.click();

  URL.revokeObjectURL(url);
}

function startLoading() {
  loadingSection.classList.remove("hidden");
  resultSection.classList.add("hidden");
  statusText.textContent = "Analyzing media...";
  scanBtn.disabled = true;

  let progress = 0;
  progressBar.style.width = "0%";
  loadingText.textContent = "Sending media URL to backend...";

  progressInterval = setInterval(() => {
    if (progress < 35) {
      progress += 5;
      loadingText.textContent = "Downloading media...";
    } else if (progress < 65) {
      progress += 3;
      loadingText.textContent = "Transcribing audio...";
    } else if (progress < 90) {
      progress += 1;
      loadingText.textContent = "Scoring accessibility...";
    }

    progressBar.style.width = `${progress}%`;
  }, 250);
}

function stopLoading() {
  clearInterval(progressInterval);
  progressBar.style.width = "100%";

  setTimeout(() => {
    loadingSection.classList.add("hidden");
    scanBtn.disabled = false;
    statusText.textContent = "Report ready.";
  }, 300);
}

function resetUI() {
  mediaSection.classList.add("hidden");
  loadingSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  mediaList.innerHTML = "";
  progressBar.style.width = "0%";
}

function capitalize(value) {
  if (!value || typeof value !== "string") return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}