document.addEventListener("DOMContentLoaded", () => {
  const data = document.getElementById("news-data");
  if (!data) return;
  let allNews;
  try {
    allNews = JSON.parse(data.textContent);
    if (!Array.isArray(allNews)) return;
  } catch (error) {
    console.error("Cannot enable news search", error);
    return; // The static articles and pagination remain usable.
  }
  const list = document.getElementById("news-list");
  const empty = document.getElementById("news-empty");
  const search = document.getElementById("news-search");
  const nav = document.getElementById("news-pagination");
  const pagination = nav.querySelector(".pagination");
  const initialList = list.innerHTML;
  const initialPagination = pagination.innerHTML;
  const initialDisplay = nav.style.display;
  let filtered = allNews;
  let filtering = false;
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

  function render(page) {
    empty.style.display = filtered.length ? "none" : "block";
    list.innerHTML = filtered.slice((page - 1) * 10, page * 10).map((news) => {
      const label = {news: "公告", maintenance: "维护", feature: "新功能"}[news.category] || "其他";
      return `<article class="card news-item mb-4${news.important ? " border-primary" : ""}"><div class="card-body">
        <h2 class="h5 card-title"><a href="${escape(news.url)}">${escape(news.title)}</a></h2>
        <div class="mb-2 text-muted"><small>${escape(news.date)} · ${escape(news.author)}</small>
        ${news.important ? '<span class="badge bg-warning text-dark">重要</span>' : ""}
        <span class="badge bg-primary">${label}</span></div>
        <p class="card-text">${escape(news.excerpt)}</p>
        <a href="${escape(news.url)}" class="btn btn-sm btn-outline-primary">阅读全文</a>
      </div></article>`;
    }).join("");
    const pages = Math.ceil(filtered.length / 10);
    nav.style.display = pages > 1 ? "block" : "none";
    pagination.innerHTML = Array.from({length: pages}, (_, i) => `<li class="page-item${i + 1 === page ? " active" : ""}"><button type="button" class="page-link" data-page="${i + 1}" ${i + 1 === page ? 'aria-current="page"' : ""}>${i + 1}</button></li>`).join("");
  }
  function filter() {
    const term = search.value.trim().toLowerCase();
    const category = document.querySelector('input[name="category-filter"]:checked').value;
    filtering = Boolean(term || category !== "all");
    if (!filtering) {
      list.innerHTML = initialList;
      pagination.innerHTML = initialPagination;
      nav.style.display = initialDisplay;
      empty.style.display = "none";
      return;
    }
    filtered = allNews.filter((news) => (category === "all" || news.category === category) &&
      `${news.title} ${news.excerpt}`.toLowerCase().includes(term));
    render(1);
  }
  search.addEventListener("input", filter);
  document.querySelectorAll('input[name="category-filter"]').forEach((input) => input.addEventListener("change", filter));
  pagination.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (filtering && button) render(Number(button.dataset.page));
  });
});
