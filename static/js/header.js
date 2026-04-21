// Hide header on scroll down, show on scroll up.
// Also toggles menu-icon for mobile nav.

(function () {
  "use strict";

  function setupScrollBehavior() {
    const header = document.querySelector(".header") || document.querySelector(".navbar");
    if (!header) return;

    // Skip on fancyindex listing pages
    if (document.getElementById("path") && document.getElementById("list")) return;

    header.classList.remove("header-hidden");

    let lastScrollTop = 0;
    window.addEventListener("scroll", function () {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      if (scrollTop > lastScrollTop && scrollTop > 80) {
        header.classList.add("header-hidden", "scrolled");
      } else {
        header.classList.remove("header-hidden");
        if (scrollTop > 50) {
          header.classList.add("scrolled");
        } else {
          header.classList.remove("scrolled");
        }
      }
      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }, { passive: true });
  }

  function setupMobileMenu() {
    const menuBtn = document.querySelector(".menu-icon");
    const navList = document.querySelector(".nav-list");
    if (!menuBtn || !navList) return;

    menuBtn.addEventListener("click", function () {
      const isOpen = navList.classList.toggle("open");
      navList.classList.toggle("active", isOpen);
      menuBtn.classList.toggle("active", isOpen);
      menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Close on outside click
    document.addEventListener("click", function (e) {
      if (!navList.contains(e.target) && !menuBtn.contains(e.target)) {
        navList.classList.remove("open", "active");
        menuBtn.classList.remove("active");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setupScrollBehavior();
      setupMobileMenu();
    });
  } else {
    setupScrollBehavior();
    setupMobileMenu();
  }
})();
