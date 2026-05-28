document.addEventListener("DOMContentLoaded", () => {
  const flowchartContainer = document.getElementById("flowchart-main-container");
  const svgCanvas = document.getElementById("connector-svg");
  const searchInput = document.getElementById("search-input");
  const searchResultsContainer = document.getElementById("search-results-container");

  const solutionModal = document.getElementById("solution-modal");
  const contactModal = document.getElementById("contact-modal");
  const contactFab = document.getElementById("contact-fab");

  let categories = [];
  let articles = [];
  let searchIndex = [];

  const categoryColors = {
    Network: "#ef4444",
    SAP: "#eab308",
    CIMCO: "#22c55e",
    Printer: "#3b82f6",
    Software: "#8b5cf6",
    Hardware: "#ec4899",
    Email: "#f97316",
    phone: "#dc2626"
  };

  fetch("/api/admin_dashboard")
    .then(res => res.json())
    .then(result => {
      if (!result.success) {
        flowchartContainer.innerHTML = "โหลดข้อมูลไม่สำเร็จ";
        return;
      }

      articles = result.articles || [];

      categories = (result.support_nodes || [])
        .filter(node => node.type === "category")
        .map(node => ({
          id: node.id,
          title: node.title,
          description: node.description || "",
          color: node.color || categoryColors[node.title] || "#dc2626",
          icon: getCategoryIcon(node.title)
        }));

      buildSearchIndex();
      initFlowchart();
    })
    .catch(error => {
      console.error(error);
      flowchartContainer.innerHTML = "เชื่อมต่อ API ไม่สำเร็จ";
    });

  function createNode(item, level) {
    const node = document.createElement("div");

    node.className = "flowchart-node";
    node.dataset.id = item.id;
    node.dataset.level = level;
    node.style.setProperty("--hover-color", item.color || item.categoryColor || "#ef4444");

    if (level === 0) {
      node.style.borderTopColor = item.color;
    }

    let iconHtml = "";

    if (level === 0) {
      iconHtml = item.icon || iconQuestion();
    } else if (level === 1) {
      iconHtml = iconWarning();
    } else {
      iconHtml = item.type === "contact" ? iconContact() : iconQuestion();
    }

    node.innerHTML = `
      <div class="icon">${iconHtml}</div>
      <div class="flowchart-node-text">
        <h3>${escapeHtml(item.title || "")}</h3>
        <p>${escapeHtml(item.problem || item.description || item.text || "")}</p>
      </div>
    `;

    node.addEventListener("click", () => handleNodeClick(node, item, level));

    return node;
  }

  function handleNodeClick(nodeEl, item, level) {
    const wasActive = nodeEl.classList.contains("active");

    let currentLevel = level + 1;
    let nextLevelEl;

    while ((nextLevelEl = document.getElementById(`level-${currentLevel}`))) {
      nextLevelEl.remove();
      currentLevel++;
    }

    nodeEl.parentElement.querySelectorAll(".flowchart-node").forEach(node => {
      node.classList.remove("active");
    });

    if (wasActive) {
      drawAllConnectors();
      return;
    }

    nodeEl.classList.add("active");

    let childrenData = [];

    if (level === 0) {
      childrenData = articles
        .filter(article => article.category === item.title)
        .map(article => ({
          ...article,
          categoryColor: item.color
        }));
    }

    if (level === 1) {
      const steps = item.steps || [];

      childrenData = steps.map(step => ({
        id: `step-${step.id}`,
        title: `STEP ${step.step_order}: ${step.step_title}`,
        text: step.step_detail,
        type: "step",
        categoryColor: item.categoryColor
      }));

      if (childrenData.length === 0 && item.solution) {
        childrenData.push({
          id: `solution-${item.id}`,
          title: "STEP 1: วิธีแก้ไข",
          text: item.solution,
          type: "step",
          categoryColor: item.categoryColor
        });
      }

      childrenData.push({
        id: `contact-${item.id}`,
        title: "ยังไม่หาย",
        text: "ติดต่อแผนก IT Support",
        type: "contact",
        categoryColor: item.categoryColor
      });
    }

    if (childrenData.length > 0) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "flowchart-level";
      childrenContainer.id = `level-${level + 1}`;

      const parentColor = getComputedStyle(nodeEl).getPropertyValue("--hover-color");

      childrenData.forEach(child => {
        const childNode = createNode(child, level + 1);
        childNode.style.setProperty("--hover-color", parentColor);
        childNode.style.borderTopColor = parentColor;
        childrenContainer.appendChild(childNode);
      });

      flowchartContainer.appendChild(childrenContainer);

      setTimeout(() => {
        const parentRect = nodeEl.getBoundingClientRect();
        const containerRect = flowchartContainer.getBoundingClientRect();
        const childrenHeight = childrenContainer.offsetHeight;
        const parentCenterY = parentRect.top - containerRect.top + parentRect.height / 2;

        childrenContainer.style.top = `${Math.max(0, parentCenterY - childrenHeight / 2)}px`;

        drawAllConnectors();
      }, 50);
    } else {
      if (item.type === "contact") {
        showModal(contactModal);
      } else {
        document.getElementById("solution-title").textContent = item.title || "วิธีแก้ไขปัญหา";
        document.getElementById("solution-text").textContent = item.text || "";
        showModal(solutionModal);
      }

      drawAllConnectors();
    }
  }

  function initFlowchart() {
    flowchartContainer.innerHTML = "";
    flowchartContainer.appendChild(svgCanvas);

    const level0 = document.createElement("div");
    level0.className = "flowchart-level";
    level0.id = "level-0";

    flowchartContainer.appendChild(level0);

    if (categories.length === 0) {
      level0.innerHTML = "<p>ยังไม่มีหัวข้อหลัก</p>";
      return;
    }

    categories.forEach(category => {
      level0.appendChild(createNode(category, 0));
    });
  }

  function drawAllConnectors() {
    svgCanvas.innerHTML = "";

    const levels = Array.from(flowchartContainer.children).filter(el =>
      el.classList.contains("flowchart-level")
    );

    for (let i = 0; i < levels.length - 1; i++) {
      const parentNode = levels[i].querySelector(".flowchart-node.active");
      const nextLevel = levels[i + 1];

      if (parentNode && nextLevel) {
        const color = getComputedStyle(parentNode).getPropertyValue("--hover-color");

        nextLevel.querySelectorAll(".flowchart-node").forEach(childNode => {
          drawConnector(parentNode, childNode, color);
        });
      }
    }
  }

  function drawConnector(parentEl, childEl, color) {

  const containerRect = flowchartContainer.getBoundingClientRect();

  const parentRect = parentEl.getBoundingClientRect();
  const childRect = childEl.getBoundingClientRect();

  const startX =
    parentRect.right - containerRect.left;

  const startY =
    parentRect.top +
    parentRect.height / 2 -
    containerRect.top;

  const endX =
    childRect.left - containerRect.left;

  const endY =
    childRect.top +
    childRect.height / 2 -
    containerRect.top;

  // จุดกลาง
  const middleX = startX + 50;

  const path =
    `
    M ${startX} ${startY}

    L ${middleX} ${startY}

    L ${middleX} ${endY}

    L ${endX} ${endY}
    `;

  const line =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );

  line.setAttribute("d", path);

  line.style.stroke = color || "#94a3b8";
  line.style.fill = "none";
  line.style.strokeWidth = "2.5";
  line.style.strokeLinecap = "round";
  line.style.strokeLinejoin = "round";

  svgCanvas.appendChild(line);
}

  function buildSearchIndex() {
    searchIndex = [];

    categories.forEach(category => {
      searchIndex.push({
        text: category.title,
        parentText: "หมวดหมู่",
        path: [category.id]
      });
    });

    articles.forEach(article => {
      const category = categories.find(cat => cat.title === article.category);

      if (!category) return;

      searchIndex.push({
        text: article.title,
        parentText: `ใน: ${article.category}`,
        path: [category.id, article.id]
      });
    });
  }

  function handleSearch() {
    const query = searchInput.value.toLowerCase();
    searchResultsContainer.innerHTML = "";

    if (query.length < 2) return;

    const results = searchIndex.filter(item =>
      item.text.toLowerCase().includes(query)
    );

    results.forEach(item => {
      const resultEl = document.createElement("div");
      resultEl.className = "search-result-item";
      resultEl.innerHTML = `
        <strong>${escapeHtml(item.text)}</strong>
        <span>${escapeHtml(item.parentText)}</span>
      `;

      resultEl.addEventListener("click", async () => {
        searchInput.value = "";
        searchResultsContainer.innerHTML = "";
        await buildFlowchartToNode(item.path);
      });

      searchResultsContainer.appendChild(resultEl);
    });
  }

  async function buildFlowchartToNode(path) {
    initFlowchart();
    await wait(100);

    for (const nodeId of path) {
      const node = flowchartContainer.querySelector(`.flowchart-node[data-id="${nodeId}"]`);

      if (node) {
        node.click();
        await wait(400);
      }
    }
  }

  function showModal(modal) {
    modal.classList.add("show");
  }

  function hideModal(modal) {
    modal.classList.remove("show");
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  document.querySelectorAll(".close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      hideModal(solutionModal);
      hideModal(contactModal);
    });
  });

  [solutionModal, contactModal].forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        hideModal(modal);
      }
    });
  });

  contactFab.addEventListener("click", () => showModal(contactModal));
  searchInput.addEventListener("input", handleSearch);
  window.addEventListener("resize", drawAllConnectors);

  function getCategoryIcon(name) {
    if (name === "Network") return iconNetwork();
    if (name === "SAP") return iconDatabase();
    if (name === "CIMCO") return iconGear();
    if (name === "Printer") return iconPrinter();
    if (name === "Software") return iconSoftware();
    if (name === "Hardware") return iconHardware();
    if (name === "Email") return iconEmail();

    return iconQuestion();
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function iconNetwork() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M12 21a9 9 0 100-18 9 9 0 000 18zm-9-9h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/></svg>`;
  }

  function iconDatabase() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M4 7c0 2 3.5 4 8 4s8-2 8-4-3.5-4-8-4-8 2-8 4zm0 0v10c0 2 3.5 4 8 4s8-2 8-4V7"/></svg>`;
  }

  function iconGear() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M12 15a3 3 0 100-6 3 3 0 000 6zm8-3a8 8 0 01-.2 1.8l2 1.5-2 3.4-2.4-1a8 8 0 01-3 1.7L14 22h-4l-.4-2.6a8 8 0 01-3-1.7l-2.4 1-2-3.4 2-1.5A8 8 0 014 12c0-.6.1-1.2.2-1.8l-2-1.5 2-3.4 2.4 1a8 8 0 013-1.7L10 2h4l.4 2.6a8 8 0 013 1.7l2.4-1 2 3.4-2 1.5c.1.6.2 1.2.2 1.8z"/></svg>`;
  }

  function iconPrinter() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M6 9V3h12v6M6 17H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2M6 14h12v7H6z"/></svg>`;
  }

  function iconSoftware() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M7 8l3 2-3 2m5 0h4M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>`;
  }

  function iconHardware() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M4 5h16v10H4zM8 21h8m-4-6v6"/></svg>`;
  }

  function iconEmail() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M4 6h16v12H4zM4 7l8 6 8-6"/></svg>`;
  }

  function iconWarning() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M12 9v4m0 4h.01M10.3 4.3L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z"/></svg>`;
  }

  function iconQuestion() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M12 18h.01M9.5 9a2.5 2.5 0 115 0c0 2-2.5 2-2.5 4M12 22a10 10 0 100-20 10 10 0 000 20z"/></svg>`;
  }

  function iconContact() {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="1.5" d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5z"/></svg>`;
  }
});