// Reusable Navbar Component

document.addEventListener("DOMContentLoaded", () => {
  const placeholder = document.getElementById("navbar-placeholder");
  if (!placeholder) return;

  // Determine relative paths based on folder depth
  const isSubPage = window.location.pathname.includes("/pages/civic/") || 
                    window.location.pathname.includes("/pages/rescue/") || 
                    window.location.pathname.includes("/pages/medical/");
  
  const basePath = isSubPage ? "../../" : "";
  const pagePath = isSubPage ? "../" : "pages/";

  placeholder.innerHTML = `
    <nav class="navbar">
      <div class="container navbar-container">
        <a href="${basePath}index.html" class="brand">
          <span>🏛️</span> GovConnect
        </a>
        <ul class="nav-links">
          <li><a href="${basePath}index.html" class="nav-link" id="nav-home">Home</a></li>
          <li><a href="${basePath}${pagePath}civic/index.html" class="nav-link" id="nav-civic">Civic Issues</a></li>
          <li><a href="${basePath}${pagePath}rescue/index.html" class="nav-link" id="nav-rescue">Rescue Services</a></li>
          <li><a href="http://127.0.0.1:8000/" class="nav-link" id="nav-medical">Medical Emergency</a></li>
        </ul>
      </div>
    </nav>
  `;

  // Highlight active page
  const currentPath = window.location.pathname;
  if (currentPath.includes("civic")) {
    document.getElementById("nav-civic")?.classList.add("active");
  } else if (currentPath.includes("rescue")) {
    document.getElementById("nav-rescue")?.classList.add("active");
  } else if (currentPath.includes("medical")) {
    document.getElementById("nav-medical")?.classList.add("active");
  } else {
    document.getElementById("nav-home")?.classList.add("active");
  }
});
