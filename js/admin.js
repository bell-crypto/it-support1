document.addEventListener("DOMContentLoaded", () => {
  setupSidebar();
  setupLogout();
  setActiveMenu();
});

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
        method: "POST"
      });
    } catch (err) {
      console.error(err);
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
