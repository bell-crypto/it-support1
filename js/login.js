document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const message = document.getElementById("loginMessage");

  const res = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  const result = await res.json();

  if (result.success) {
    window.location.href = "dashboard.html";
  } else {
    message.textContent = result.message || "เข้าสู่ระบบไม่สำเร็จ";
  }
});