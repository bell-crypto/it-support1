const formBox = document.getElementById("categoryFormBox");

document.addEventListener("DOMContentLoaded", () => {
  loadCategories();

  document.getElementById("openFormBtn")?.addEventListener("click", () => {
    clearForm();
    generateNextSortOrder();
    formBox.classList.add("show");
  });

  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    clearForm();
    formBox.classList.remove("show");
  });

  document.getElementById("saveBtn")?.addEventListener("click", saveCategory);
});

async function loadCategories() {
  try {
    const res = await fetch("/api/admin_dashboard");
    const data = await res.json();

    if (!data.success) {
      alert(data.message || "โหลดหัวข้อหลักไม่สำเร็จ");
      return;
    }

    const nodes = data.support_nodes || [];

    const categories = nodes
      .filter(n => n.type === "category")
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map(n => ({
        id: n.id,
        title: n.title,
        description: n.description || "-",
        color: n.color || getCategoryColor(n.title),
        sort_order: n.sort_order || 0,
        status: "active"
      }));

    renderCategories(categories);

  } catch (error) {
    console.error(error);
    alert("โหลดหัวข้อหลักไม่สำเร็จ");
  }
}

function renderCategories(categories) {
  const tbody = document.getElementById("categoryTable");

  if (!tbody) return;

  if (categories.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#64748b;">
          ยังไม่มีหัวข้อหลัก
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = categories.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td>${escapeHtml(item.description)}</td>
      <td><span class="color-dot" style="background:${item.color}"></span></td>
      <td>${item.sort_order}</td>
      <td><span class="badge">${item.status}</span></td>
      <td>
        <button class="action-btn edit-btn"
          onclick="editCategory(${item.id}, '${escapeAttr(item.title)}', '${escapeAttr(item.description)}', '${item.color}', ${item.sort_order})">
          แก้ไข
        </button>

        <button class="action-btn delete-btn"
          onclick="deleteCategory(${item.id})">
          ลบ
        </button>
      </td>
    </tr>
  `).join("");
}

function generateNextSortOrder() {
  const rows = document.querySelectorAll("#categoryTable tr");
  let max = 0;

  rows.forEach(row => {
    const value = parseInt(row.children[3]?.textContent) || 0;
    if (value > max) max = value;
  });

  document.getElementById("sortOrder").value = max + 1;
}

function editCategory(id, title, description, color, sortOrder) {
  document.getElementById("categoryId").value = id;
  document.getElementById("title").value = title;
  document.getElementById("description").value = description === "-" ? "" : description;
  document.getElementById("color").value = color || "#dc2626";
  document.getElementById("sortOrder").value = sortOrder || 0;

  formBox.classList.add("show");
}

async function saveCategory() {
  const id = document.getElementById("categoryId").value;
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const color = document.getElementById("color").value;
  const sort_order = document.getElementById("sortOrder").value || 0;

  if (!title) {
    alert("กรุณากรอกชื่อหัวข้อ");
    return;
  }

  const url = id
    ? "/api/support_node_update"
    : "/api/support_node_create";

  const payload = {
    id,
    parent_id: null,
    type: "category",
    title,
    description,
    color,
    sort_order
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
    await loadCategories();

  } catch (error) {
    console.error(error);
    alert("เชื่อมต่อ API ไม่ได้");
  }
}

async function deleteCategory(id) {
  if (!confirm("ต้องการลบหัวข้อนี้ใช่ไหม?")) return;

  try {
    const res = await fetch("/api/support_node_delete", {
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

    await loadCategories();

  } catch (error) {
    console.error(error);
    alert("เชื่อมต่อ API ไม่ได้");
  }
}

function clearForm() {
  document.getElementById("categoryId").value = "";
  document.getElementById("title").value = "";
  document.getElementById("description").value = "";
  document.getElementById("color").value = "#dc2626";
  document.getElementById("sortOrder").value = "1";
}

function escapeAttr(text) {
  return String(text)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', "&quot;");
}