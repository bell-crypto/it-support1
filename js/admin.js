document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();

  setupSidebar();
  setupLogout();
  setActiveMenu();
});

async function checkAuth() {
  try {
    const res = await fetch("/api/admin_check", {
      method: "GET",
      cache: "no-store"
    });

    if (!res.ok) {
      window.location.replace("/admin/login.html");
      return;
    }

    const result = await res.json();

    if (!result.success) {
      window.location.replace("/admin/login.html");
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    window.location.replace("/admin/login.html");
  }
}

function setupSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggleSidebar = document.getElementById("toggleSidebar");

  if (!sidebar || !toggleSidebar) return;

  toggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
}

function setupLogout() {
  const logoutBtn = document.getElementById("logoutBtn");

  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      await fetch("/api/logout", {
        method: "POST",
        cache: "no-store"
      });
    } catch (err) {
      console.error("Logout failed:", err);
    }

    window.location.replace("/admin/login.html");
  });
}

function setActiveMenu() {
  const currentPage = location.pathname.split("/").pop();

  document.querySelectorAll(".menu a").forEach(link => {
    const href = link.getAttribute("href");

    if (href === currentPage) {
      link.classList.add("active");
    }
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}