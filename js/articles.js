/* =========================================
   articles.js
   JS สำหรับหน้า admin/article_form.html
========================================= */

const formBox = document.getElementById("articleFormBox");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const filterCategory = document.getElementById("filterCategory");
const sortSelect = document.getElementById("sortSelect");
const searchSummary = document.getElementById("searchSummary");

let categories = [];
let articles = [];
let searchTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  document.getElementById("openFormBtn")?.addEventListener("click", () => {
    clearForm();
    addStep();
    formBox.classList.add("show");
  });

  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    clearForm();
    formBox.classList.remove("show");
  });

  document.getElementById("saveBtn")?.addEventListener("click", saveArticle);

  searchInput?.addEventListener("input", () => {
    clearSearchBtn.classList.toggle("show", searchInput.value.trim() !== "");

    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderArticles, 250);
  });

  clearSearchBtn?.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.classList.remove("show");
    renderArticles();
    searchInput.focus();
  });

  filterCategory?.addEventListener("change", renderArticles);
  sortSelect?.addEventListener("change", renderArticles);
});

async function loadData() {
  try {
    const res = await fetch("/api/admin_dashboard");

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "โหลดข้อมูลไม่สำเร็จ");
      return;
    }

    categories = (data.support_nodes || [])
      .filter(node => node.type === "category")
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

    articles = data.articles || [];

    renderCategoryOptions();
    renderArticles();

  } catch (error) {
    console.error("loadData error:", error);
    alert("โหลดข้อมูลจาก API ไม่ได้");
  }
}

function renderCategoryOptions() {
  const select = document.getElementById("category");

  if (!select || !filterCategory) return;

  select.innerHTML = `<option value="">-- เลือกหัวข้อหลัก --</option>`;
  filterCategory.innerHTML = `<option value="">ทุกหมวด</option>`;

  categories.forEach(category => {
    select.innerHTML += `
      <option value="${escapeAttr(category.title)}">
        ${escapeHtml(category.sort_order)}. ${escapeHtml(category.title)}
      </option>
    `;

    filterCategory.innerHTML += `
      <option value="${escapeAttr(category.title)}">
        ${escapeHtml(category.title)}
      </option>
    `;
  });
}

function renderArticles() {
  const tbody = document.getElementById("articleTable");
  if (!tbody) return;

  const validCategoryNames = categories.map(c => c.title);
  const keyword = searchInput?.value.trim() || "";
  const selectedCategory = filterCategory?.value || "";
  const sortValue = sortSelect?.value || "latest";

  const categoryMap = {};

  categories.forEach(c => {
    categoryMap[c.title] = c.color || "#dc2626";
  });

  let filteredArticles = articles.filter(article => {
    const steps = article.steps || [];

    const matchValidCategory = validCategoryNames.includes(article.category);
    const matchCategory = !selectedCategory || article.category === selectedCategory;

    const matchKeyword =
      !keyword ||
      isSmartMatch(article.title, keyword) ||
      isSmartMatch(article.problem, keyword) ||
      isSmartMatch(article.category, keyword) ||
      steps.some(step =>
        isSmartMatch(step.step_title || step.title, keyword) ||
        isSmartMatch(step.step_detail || step.detail, keyword)
      );

    return matchValidCategory && matchCategory && matchKeyword;
  });

  filteredArticles = sortArticles(filteredArticles, sortValue);

  renderSearchSummary(filteredArticles.length, keyword, selectedCategory);

  if (filteredArticles.length === 0) {
    const message = keyword || selectedCategory
      ? `ไม่พบปัญหาที่ค้นหา<br>ลองเปลี่ยนคำค้นหา หรือเลือกหมวดอื่น`
      : `ยังไม่มีข้อมูลปัญหา`;

    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">${message}</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredArticles.map(article => {
    const categoryColor = categoryMap[article.category] || "#dc2626";
    const steps = article.steps || [];
    const stepsData = encodeURIComponent(JSON.stringify(steps));

    return `
      <tr>
        <td>
          <span class="badge" style="
            background:${hexToRgba(categoryColor, 0.12)};
            color:${categoryColor};
            border-color:${hexToRgba(categoryColor, 0.25)};
          ">
            ${highlightText(article.category || "-", keyword)}
          </span>
        </td>

        <td>
          <strong>${highlightText(article.title || "-", keyword)}</strong>
        </td>

        <td class="text-muted">
          ${highlightText(article.problem || "-", keyword)}
        </td>

        <td>
          <span class="badge">${steps.length} Step</span>
        </td>

        <td>
          <button class="action-btn edit-btn"
            onclick="editArticle(
              ${article.id},
              '${escapeAttr(article.category)}',
              '${escapeAttr(article.title)}',
              '${escapeAttr(article.problem)}',
              '${stepsData}'
            )">
            แก้ไข
          </button>

          <button class="action-btn delete-btn" onclick="deleteArticle(${article.id})">
            ลบ
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderSearchSummary(count, keyword, selectedCategory) {
  if (!searchSummary) return;

  if (!keyword && !selectedCategory) {
    searchSummary.classList.remove("show");
    searchSummary.innerHTML = "";
    return;
  }

  const keywordText = keyword ? `คำค้นหา: <strong>${escapeHtml(keyword)}</strong>` : "";
  const categoryText = selectedCategory ? `หมวด: <strong>${escapeHtml(selectedCategory)}</strong>` : "";
  const separator = keyword && selectedCategory ? " | " : "";

  searchSummary.classList.add("show");
  searchSummary.innerHTML = `พบ ${count} รายการ ${keywordText}${separator}${categoryText}`;
}

function sortArticles(list, sortValue) {
  const copied = [...list];

  if (sortValue === "title_asc") {
    return copied.sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), "th")
    );
  }

  if (sortValue === "steps_desc") {
    return copied.sort((a, b) => (b.steps || []).length - (a.steps || []).length);
  }

  if (sortValue === "steps_asc") {
    return copied.sort((a, b) => (a.steps || []).length - (b.steps || []).length);
  }

  return copied.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

function addStep(title = "", detail = "") {
  const container = document.getElementById("stepsContainer");
  if (!container) return;

  const index = container.children.length + 1;

  const box = document.createElement("div");
  box.className = "step-box";

  box.innerHTML = `
    <div class="step-head">
      <strong>STEP ${index}</strong>

      <button type="button" class="action-btn delete-btn"
        onclick="this.closest('.step-box').remove(); refreshStepLabels();">
        ลบ Step
      </button>
    </div>

    <div class="step-grid">
      <div>
        <label>ชื่อ Step</label>
        <input
          type="text"
          class="step-title"
          value="${escapeAttr(title || "STEP " + index)}"
          placeholder="เช่น ตรวจสอบเครื่องพิมพ์"
        >
      </div>

      <div>
        <label>รายละเอียด Step</label>
        <textarea
          class="step-detail"
          placeholder="รายละเอียดวิธีแก้ไข"
        >${escapeHtml(detail)}</textarea>
      </div>
    </div>
  `;

  container.appendChild(box);
}

function refreshStepLabels() {
  document.querySelectorAll("#stepsContainer .step-box").forEach((box, index) => {
    box.querySelector(".step-head strong").textContent = `STEP ${index + 1}`;
  });
}

function editArticle(id, category, title, problem, stepsJson) {
  document.getElementById("articleId").value = id;
  document.getElementById("category").value = category;
  document.getElementById("title").value = title;
  document.getElementById("problem").value = problem;
  document.getElementById("stepsContainer").innerHTML = "";

  let steps = [];

  try {
    steps = JSON.parse(decodeURIComponent(stepsJson || "[]"));
  } catch (e) {
    steps = [];
  }

  if (steps.length === 0) {
    addStep();
  } else {
    steps.forEach(step => {
      addStep(step.step_title || step.title || "", step.step_detail || step.detail || "");
    });
  }

  formBox.classList.add("show");
}

async function saveArticle() {
  const id = document.getElementById("articleId").value;
  const category = document.getElementById("category").value;
  const title = document.getElementById("title").value.trim();
  const problem = document.getElementById("problem").value.trim();

  const steps = [...document.querySelectorAll("#stepsContainer .step-box")]
    .map(box => ({
      title: box.querySelector(".step-title").value.trim(),
      detail: box.querySelector(".step-detail").value.trim()
    }))
    .filter(step => step.detail !== "");

  if (!category || !title || steps.length === 0) {
    alert("กรุณากรอกหัวข้อหลัก ชื่อปัญหา และอย่างน้อย 1 Step");
    return;
  }

  const url = id
    ? "/api/article_update"
    : "/api/article_create";

  const payload = {
    id,
    category,
    title,
    problem,
    steps
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "บันทึกไม่สำเร็จ");
      return;
    }

    clearForm();
    formBox.classList.remove("show");
    await loadData();

  } catch (error) {
    console.error("saveArticle error:", error);
    alert("เชื่อมต่อ API ไม่ได้");
  }
}

async function deleteArticle(id) {
  if (!confirm("ต้องการลบปัญหานี้ใช่ไหม?")) return;

  try {
    const res = await fetch("/api/article_delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "ลบไม่สำเร็จ");
      return;
    }

    await loadData();

  } catch (error) {
    console.error("deleteArticle error:", error);
    alert("เชื่อมต่อ API ไม่ได้");
  }
}

function clearForm() {
  document.getElementById("articleId").value = "";
  document.getElementById("category").value = "";
  document.getElementById("title").value = "";
  document.getElementById("problem").value = "";
  document.getElementById("stepsContainer").innerHTML = "";
}

/* =========================================
   Search helper
========================================= */

function normalizeSearchText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[่้๊๋์]/g, "")
    .replace(/[ิีึืุูั็]/g, "")
    .replace(/[\s\-_./\\]+/g, "")
    .replace(/เครื่องพิมพ์/g, "printer")
    .replace(/ปริ้นเตอร์/g, "printer")
    .replace(/พรินเตอร์/g, "printer")
    .replace(/ปริ้น/g, "print")
    .replace(/พิมพ์/g, "print")
    .replace(/ไวไฟ/g, "wifi")
    .replace(/วายฟาย/g, "wifi")
    .replace(/wi-fi/g, "wifi")
    .replace(/wireless/g, "wifi")
    .replace(/อินเตอร์เน็ต/g, "internet")
    .replace(/อินเทอร์เน็ต/g, "internet")
    .replace(/เน็ต/g, "internet");
}

function getSearchKeywords(keyword) {
  const raw = String(keyword || "").toLowerCase().trim();
  const normalized = normalizeSearchText(raw);

  const synonyms = {
    "ไม": ["ไม", "ไม่", "ไม้", "ไหม"],
    "printer": ["printer", "print", "ปริ้น", "พิมพ์", "เครื่องพิมพ์", "พรินเตอร์", "ปริ้นเตอร์"],
    "print": ["printer", "print", "ปริ้น", "พิมพ์", "เครื่องพิมพ์"],
    "wifi": ["wifi", "wi-fi", "ไวไฟ", "วายฟาย", "wireless", "สัญญาณ"],
    "internet": ["internet", "อินเตอร์เน็ต", "อินเทอร์เน็ต", "เน็ต", "lan", "network"],
    "network": ["network", "internet", "เน็ต", "lan", "wifi", "ไวไฟ"],
    "email": ["email", "e-mail", "mail", "เมล", "อีเมล", "อีเมล์"],
    "sap": ["sap"],
    "offline": ["offline", "ออฟไลน์", "ไม่ออนไลน์"],
    "driver": ["driver", "ไดรเวอร์", "ไดร์เวอร์"],
    "jam": ["jam", "paperjam", "กระดาษติด", "กระดาษค้าง"]
  };

  const set = new Set([raw, normalized]);

  Object.keys(synonyms).forEach(key => {
    const normalizedSynonyms = synonyms[key].map(item => normalizeSearchText(item));

    if (
      raw === key ||
      normalized === normalizeSearchText(key) ||
      synonyms[key].some(item => raw.includes(item.toLowerCase())) ||
      normalizedSynonyms.some(item => normalized.includes(item))
    ) {
      synonyms[key].forEach(item => {
        set.add(item.toLowerCase());
        set.add(normalizeSearchText(item));
      });
    }
  });

  return [...set].filter(Boolean);
}

function isSmartMatch(text, keyword) {
  const rawText = String(text || "").toLowerCase();
  const normText = normalizeSearchText(rawText);
  const keywords = getSearchKeywords(keyword);

  return keywords.some(word => {
    const normWord = normalizeSearchText(word);

    return (
      rawText.includes(word) ||
      normText.includes(normWord) ||
      fuzzyMatch(normText, normWord)
    );
  });
}

function fuzzyMatch(text, keyword) {
  if (!keyword || keyword.length < 4 || !text) return false;

  const words = text.split(/[\s,;:(){}\[\]|]+/).filter(Boolean);

  return words.some(word => {
    if (word.includes(keyword) || keyword.includes(word)) return true;

    return levenshteinDistance(word, keyword) <=
      Math.max(1, Math.floor(keyword.length * 0.25));
  });
}

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
    }
  }

  return matrix[b.length][a.length];
}

function highlightText(text, keyword) {
  const safeText = escapeHtml(text);

  if (!keyword) return safeText;

  const rawKeyword = String(keyword || "").trim();
  if (!rawKeyword) return safeText;

  const escapedKeyword = escapeRegExp(rawKeyword);

  return safeText.replace(
    new RegExp(`(${escapedKeyword})`, "gi"),
    `<span class="highlight">$1</span>`
  );
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* =========================================
   Helper สำรอง เผื่อ admin.js ยังไม่มี
========================================= */

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(text) {
  return String(text ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', "&quot;")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "");
}

function hexToRgba(hex, alpha = 1) {
  hex = String(hex || "#dc2626").replace("#", "");

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map(char => char + char)
      .join("");
  }

  const r = parseInt(hex.substring(0, 2), 16) || 220;
  const g = parseInt(hex.substring(2, 4), 16) || 38;
  const b = parseInt(hex.substring(4, 6), 16) || 38;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}