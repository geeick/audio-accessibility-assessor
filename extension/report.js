let latestReport = null;

document.addEventListener("DOMContentLoaded", async () => {
  const result = await chrome.storage.local.get("lastSoundAuditReport");
  latestReport = result.lastSoundAuditReport;

  if (!latestReport) {
    document.body.innerHTML = "<h1>No SoundAudit report found yet.</h1>";
    return;
  }

  fillReport(latestReport);
});

document.getElementById("downloadBtn").addEventListener("click", () => {
  if (!latestReport) {
    alert("No report available.");
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
});

function fillReport(report) {
  const languages = report.languages || [];
  const warnings = report.warnings || [];
  const recommendations = report.recommendations || [];
  const issues = report.issues || [];

  document.getElementById("score").textContent = report.overall_score ?? "--";
  document.getElementById("speechSpeed").textContent = report.speech_speed_wpm ?? "--";
  document.getElementById("backgroundNoise").textContent = capitalize(report.background_noise ?? "--");
  document.getElementById("languageCount").textContent = languages.length;

  fillLanguages(languages);
  fillList("warnings", warnings);
  fillList("recommendations", recommendations);
  fillIssuesTimeline(issues);
  fillInteractiveTranscript(report.transcript_segments || [], report.transcript || "");
}

function fillLanguages(languages) {
  const container = document.getElementById("languages");
  container.innerHTML = "";

  if (!languages.length) {
    container.textContent = "No language data available.";
    return;
  }

  languages.forEach((lang) => {
    const chip = document.createElement("span");
    chip.className = "language-chip";
    chip.textContent = `${lang.language_name || lang.language_code} (${lang.percentage}%)`;
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

function fillIssuesTimeline(issues) {
  const timeline = document.getElementById("issuesTimeline");
  timeline.innerHTML = "";

  if (!issues.length) {
    timeline.textContent = "No issues detected.";
    return;
  }

  issues.forEach((issue) => {
    const card = document.createElement("div");
    card.className = "full-issue-card";

    card.innerHTML = `
      <div class="issue-header">
        <strong>${escapeHtml(issue.type)}</strong>
        <span>${escapeHtml(issue.time)}</span>
      </div>
      <p>${escapeHtml(issue.message)}</p>
      <em class="${escapeHtml((issue.severity || "").toLowerCase())}">
        ${escapeHtml(issue.severity || "Unknown")}
      </em>
    `;

    timeline.appendChild(card);
  });
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