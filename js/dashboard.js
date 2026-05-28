document.addEventListener("DOMContentLoaded", loadDashboard);

async function loadDashboard() {
  try {
    const res = await fetch("/api/admin_dashboard");
    const data = await res.json();

    if (!data.success) {
      alert(data.message || "กรุณาเข้าสู่ระบบก่อน");
      window.location.replace("/admin/login.html");
      return;
    }

    const nodes = data.support_nodes || [];
    const articles = data.articles || [];

    renderDashboard(nodes, articles);

  } catch (err) {
    console.error(err);
    alert("โหลดข้อมูลจาก API ไม่ได้");
    window.location.replace("/admin/login.html");
  }
}

function renderDashboard(nodes, articles) {
  const nodeCategories = nodes
    .filter(n => n.type === "category")
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  document.getElementById("totalCategory").textContent = nodeCategories.length;
  document.getElementById("totalIssue").textContent = articles.length;
  document.getElementById("totalSolution").textContent =
    articles.filter(a => a.solution && a.solution.trim() !== "").length;
  document.getElementById("totalNode").textContent = nodes.length;

  const categories = nodeCategories.map(n => ({
    title: n.title,
    type: n.type,
    color: n.color || getCategoryColor(n.title),
    sort_order: n.sort_order || 0,
    status: "active"
  }));

  renderCategoryTable(categories);
}

function renderCategoryTable(categories) {
  const tbody = document.getElementById("categoryTable");

  if (!tbody) return;

  if (categories.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#64748b;">
          ยังไม่มีหัวข้อหลัก
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = categories.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td><span class="badge type-badge">${escapeHtml(item.type)}</span></td>
      <td><span class="color-dot" style="background:${item.color || '#dc2626'}"></span></td>
      <td>${item.sort_order || 0}</td>
      <td><span class="badge">${escapeHtml(item.status || "active")}</span></td>
    </tr>
  `).join("");
}