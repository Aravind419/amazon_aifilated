document.addEventListener("DOMContentLoaded", () => {
  // Theme toggling
  const themeToggle = document.getElementById("themeToggle");
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light") {
    document.documentElement.classList.add("light");
    if (themeToggle) themeToggle.checked = true;
  }
  function applyTheme(isLight) {
    document.documentElement.classList.toggle("light", isLight);
    localStorage.setItem("theme", isLight ? "light" : "dark");
  }
  if (themeToggle) {
    themeToggle.addEventListener("change", (e) => {
      applyTheme(e.target.checked);
    });
  }

  // Reveal animations for product cards
  const animatedItems = document.querySelectorAll(".fade-up");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    animatedItems.forEach((el) => observer.observe(el));
  } else {
    animatedItems.forEach((el) => el.classList.add("reveal"));
  }

  // Realtime search: fetch as user types and update grid
  const searchInput = document.getElementById("searchInput");
  const productsGrid = document.getElementById("productsGrid");
  const searchForm = document.getElementById("searchForm");
  if (searchInput && productsGrid) {
    const renderProducts = (products) => {
      productsGrid.innerHTML = products
        .map((p) => {
          const priceHtml =
            typeof p.price === "number"
              ? `<span class="price">₹${p.price.toFixed(2)}</span>`
              : "";
          return `
<article class="product-card fade-up">
  <div class="image-wrap shimmer">
    <img src="${p.imageUrl}" alt="${p.title}" loading="lazy" />
  </div>
  <div class="product-body">
    <h3 class="product-title">${p.title}</h3>
    ${p.description ? `<p class="product-desc">${p.description}</p>` : ""}
    <div class="product-footer">
      ${priceHtml}
      <a class="btn btn-primary" href="${
        p.affiliateUrl
      }" target="_blank" rel="nofollow sponsored noopener">Buy on Amazon</a>
    </div>
  </div>
</article>`;
        })
        .join("");
      // re-trigger fade-up animation on new nodes
      const newItems = productsGrid.querySelectorAll(".fade-up");
      newItems.forEach((el) => el.classList.add("reveal"));
    };

    let debounceTimer;
    const triggerSearch = async () => {
      const q = searchInput.value.trim();
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        renderProducts(data.products || []);
      } catch (e) {
        console.error(e);
      }
    };

    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(triggerSearch, 200);
    });
    if (searchForm) {
      searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        triggerSearch();
      });
    }
  }

  // Admin delete handlers
  const deleteList = document.getElementById("admin-delete-list");
  if (deleteList) {
    deleteList.addEventListener("click", async (e) => {
      const btn = e.target.closest(".delete-btn");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      if (!id) return;
      if (!confirm("Delete this product?")) return;
      btn.disabled = true;
      try {
        const res = await fetch(`/admin/products/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          const card = btn.closest(".product-card");
          if (card) {
            card.style.transition = "opacity 200ms ease, transform 220ms";
            card.style.opacity = "0";
            card.style.transform = "translateY(6px)";
            setTimeout(() => card.remove(), 220);
          }
        } else {
          alert("Failed to delete.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to delete.");
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Drag & drop upload styling
  const fileDrop = document.getElementById("fileDrop");
  const imageFileInput = document.getElementById("imageFile");
  if (fileDrop && imageFileInput) {
    ["dragenter", "dragover"].forEach((evt) =>
      fileDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDrop.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      fileDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDrop.classList.remove("dragover");
      })
    );
    fileDrop.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length) {
        imageFileInput.files = files;
      }
    });
    fileDrop.addEventListener("click", () => imageFileInput.click());
  }
});
