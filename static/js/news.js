document.addEventListener("DOMContentLoaded", function () {
  const newsDataElement = document.getElementById("news-data");
  if (!newsDataElement) {
    // News list element is only on /news/. On other pages news.js is a no-op.
    return;
  }

  let allNews = [];
  try {
    // Parse the news data from the JSON content of the script tag
    allNews = JSON.parse(newsDataElement.textContent);
  } catch (e) {
    console.error("Failed to parse news data:", e);
    // Display an error message if parsing fails
    document.getElementById("news-loading").style.display = "none";
    const newsEmpty = document.getElementById("news-empty");
    newsEmpty.innerHTML =
      '<i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i><h5 class="text-danger">无法加载新闻内容</h5><p>新闻数据格式错误，请联系管理员。</p>';
    newsEmpty.style.display = "block";
    return;
  }

  const newsList = document.getElementById("news-list");
  const newsLoading = document.getElementById("news-loading");
  const newsEmpty = document.getElementById("news-empty");
  const searchInput = document.getElementById("news-search");
  const categoryFilters = document.querySelectorAll(
    'input[name="category-filter"]'
  );
  const paginationContainer = document.querySelector(
    "#news-pagination .pagination"
  );

  let currentPage = 1;
  const itemsPerPage = 10;
  let filteredNews = allNews;

  /**
   * Renders the news articles for a specific page.
   * @param {number} page - The page number to render.
   */
  function renderNews(page = 1) {
    newsList.innerHTML = "";
    newsLoading.style.display = "none";

    if (filteredNews.length === 0) {
      newsEmpty.style.display = "block";
      newsList.style.display = "none";
      renderPagination(); // Clear pagination
      return;
    }

    newsEmpty.style.display = "none";
    newsList.style.display = "block";

    currentPage = page;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedNews = filteredNews.slice(start, end);

    paginatedNews.forEach((news) => {
      const newsItem = document.createElement("div");
      newsItem.className = "card news-item mb-4";
      if (news.important) {
        newsItem.classList.add("border-primary");
      }

      const categoryLabel = {
        news: { text: "公告", class: "bg-primary" },
        maintenance: { text: "维护", class: "bg-danger" },
        feature: { text: "新功能", class: "bg-success" },
      };
      const catInfo = categoryLabel[news.category] || {
        text: "其他",
        class: "bg-secondary",
      };

      newsItem.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <h5 class="card-title mb-1">
                            <a href="${
                              news.url
                            }" class="text-decoration-none">${news.title}</a>
                        </h5>
                        ${
                          news.important
                            ? '<span class="badge bg-warning text-dark ms-2">重要</span>'
                            : ""
                        }
                    </div>
                    <div class="mb-2 text-muted">
                        <small><i class="fas fa-calendar-alt me-1"></i> ${
                          news.date
                        }</small>
                        <span class="mx-2">|</span>
                        <small><i class="fas fa-user me-1"></i> ${
                          news.author
                        }</small>
                        <span class="mx-2">|</span>
                        <span class="badge ${catInfo.class}">${
        catInfo.text
      }</span>
                    </div>
                    <p class="card-text">${news.excerpt}</p>
                    <a href="${
                      news.url
                    }" class="btn btn-sm btn-outline-primary">阅读全文 <i class="fas fa-arrow-right"></i></a>
                </div>
            `;
      newsList.appendChild(newsItem);
    });

    renderPagination();
  }

  /**
   * Renders the pagination controls.
   */
  function renderPagination() {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = "";
    const pageCount = Math.ceil(filteredNews.length / itemsPerPage);

    if (pageCount <= 1) {
      document.getElementById("news-pagination").style.display = "none";
      return;
    }
    document.getElementById("news-pagination").style.display = "block";

    // Previous button
    const prevItem = document.createElement("li");
    prevItem.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
    prevItem.innerHTML = `<a class="page-link" href="#" data-page="${
      currentPage - 1
    }">上一页</a>`;
    paginationContainer.appendChild(prevItem);

    // Page numbers
    for (let i = 1; i <= pageCount; i++) {
      const pageItem = document.createElement("li");
      pageItem.className = `page-item ${i === currentPage ? "active" : ""}`;
      pageItem.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
      paginationContainer.appendChild(pageItem);
    }

    // Next button
    const nextItem = document.createElement("li");
    nextItem.className = `page-item ${
      currentPage === pageCount ? "disabled" : ""
    }`;
    nextItem.innerHTML = `<a class="page-link" href="#" data-page="${
      currentPage + 1
    }">下一页</a>`;
    paginationContainer.appendChild(nextItem);
  }

  /**
   * Applies the current search and category filters to the news list.
   */
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const activeCategory = document.querySelector(
      'input[name="category-filter"]:checked'
    ).value;

    filteredNews = allNews.filter((news) => {
      const matchesCategory =
        activeCategory === "all" || news.category === activeCategory;
      const matchesSearch =
        news.title.toLowerCase().includes(searchTerm) ||
        news.excerpt.toLowerCase().includes(searchTerm);
      return matchesCategory && matchesSearch;
    });

    renderNews(1); // Reset to the first page
  }

  // Event Listeners
  searchInput.addEventListener("input", applyFilters);
  categoryFilters.forEach((filter) =>
    filter.addEventListener("change", applyFilters)
  );

  if (paginationContainer) {
    paginationContainer.addEventListener("click", function (e) {
      e.preventDefault();
      if (e.target.tagName === "A" && e.target.dataset.page) {
        const page = parseInt(e.target.dataset.page, 10);
        if (page > 0 && page <= Math.ceil(filteredNews.length / itemsPerPage)) {
          renderNews(page);
        }
      }
    });
  }

  // Initial render after a short delay
  setTimeout(() => {
    applyFilters();
  }, 500);
});
