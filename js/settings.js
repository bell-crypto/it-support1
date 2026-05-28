document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  document
    .getElementById("saveSettingsBtn")
    ?.addEventListener("click", saveSettings);
});

async function loadSettings() {
  try {
    const res = await fetch("/api/settings_get");

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "โหลดการตั้งค่าไม่สำเร็จ");
      return;
    }

    const settings = data.settings || {};

    document.getElementById("siteName").value =
      settings.site_name || "IT Support Center";

    document.getElementById("systemVersion").value =
      settings.system_version || "1.0";

    document.getElementById("displayNote").value =
      settings.display_note || "";

  } catch (error) {
    console.error("loadSettings error:", error);
    alert("เชื่อมต่อ API ตั้งค่าไม่ได้");
  }
}

async function saveSettings() {
  const site_name = document.getElementById("siteName").value.trim();
  const system_version = document.getElementById("systemVersion").value.trim();
  const display_note = document.getElementById("displayNote").value.trim();

  if (!site_name || !system_version) {
    alert("กรุณากรอกชื่อระบบและเวอร์ชัน");
    return;
  }

  try {
    const res = await fetch("/api/settings_update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        site_name,
        system_version,
        display_note
      })
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "บันทึกไม่สำเร็จ");
      return;
    }

    alert(data.message || "บันทึกการตั้งค่าสำเร็จ");

  } catch (error) {
    console.error("saveSettings error:", error);
    alert("เชื่อมต่อ API ตั้งค่าไม่ได้");
  }
}