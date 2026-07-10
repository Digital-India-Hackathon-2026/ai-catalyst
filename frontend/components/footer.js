// Reusable Footer Component

document.addEventListener("DOMContentLoaded", () => {
  const placeholder = document.getElementById("footer-placeholder");
  if (!placeholder) return;

  placeholder.innerHTML = `
    <footer class="footer">
      <div class="container footer-container">
        <div>
          <strong>GovConnect Portal</strong> &copy; 2026. All rights reserved.
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; box-shadow: 0 0 8px #10b981;"></span>
          <span>All Systems Operational (Phase 1)</span>
        </div>
      </div>
    </footer>
  `;
});
