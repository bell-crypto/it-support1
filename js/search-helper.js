function normalizeSearchText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[่้๊๋์]/g, "")
    .replace(/[ิีึืุูั็]/g, "")
    .replaceAll("wi-fi", "wifi")
    .replaceAll("wireless", "wifi")
    .replaceAll("ไวไฟ", "wifi")
    .replaceAll("วายฟาย", "wifi")
    .replaceAll("printer", "print")
    .replaceAll("printing", "print")
    .replaceAll("ปริ้นเตอร์", "print")
    .replaceAll("ปริ้น", "print")
    .replaceAll("เครื่องพิมพ์", "print")
    .replaceAll("พิมพ์", "print")
    .replaceAll("internet", "net")
    .replaceAll("อินเตอร์เน็ต", "net")
    .replaceAll("อินเทอร์เน็ต", "net")
    .replaceAll("เน็ต", "net");
}

function articleSearchText(article) {
  return normalizeSearchText(`
    ${article.category || ""}
    ${article.title || ""}
    ${article.problem || ""}
    ${(article.steps || []).map(step => `
      ${step.step_title || step.title || ""}
      ${step.step_detail || step.detail || ""}
    `).join(" ")}
  `);
}

function matchArticleSearch(article, keyword) {
  const searchKeyword = normalizeSearchText(keyword);

  if (!searchKeyword) return true;

  return articleSearchText(article).includes(searchKeyword);
}

document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("search-input");

  if (!searchInput) return;

  searchInput.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;

    e.preventDefault();

    const firstResult = document.querySelector(".search-result-item");

    if (firstResult) {
      firstResult.click();
      return;
    }

    const keyword = searchInput.value.trim();

    if (!keyword) return;

    const matchedArticle = (window.articles || []).find(article =>
      matchArticleSearch(article, keyword)
    );

    if (matchedArticle) {
      window.location.href = `admin/article_form.html?id=${matchedArticle.id}`;
    }
  });
});