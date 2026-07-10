// Reusable Navbar Component

document.addEventListener("DOMContentLoaded", () => {
  const placeholder = document.getElementById("navbar-placeholder");
  if (!placeholder) return;

  // Determine relative paths based on folder depth
  const isSubPage = window.location.pathname.includes("/pages/civic/") || 
                    window.location.pathname.includes("/pages/rescue/") || 
                    window.location.pathname.includes("/pages/medical/");
  
  const homeLink = isSubPage ? "../index.html" : "index.html";
  const civicLink = isSubPage ? "../civic/index.html" : "civic/index.html";
  const rescueLink = isSubPage ? "../rescue/index.html" : "rescue/index.html";
  const medicalLink = isSubPage ? "../medical/index.html" : "medical/index.html";

  placeholder.innerHTML = `
    <nav class="navbar">
      <div class="container navbar-container">
        <a href="${homeLink}" class="brand">
          <span>🏛️</span> GovConnect
        </a>
        <ul class="nav-links">
          <li><a href="${homeLink}" class="nav-link" id="nav-home">Home</a></li>
          <li><a href="${civicLink}" class="nav-link" id="nav-civic">Civic Issues</a></li>
          <li><a href="${rescueLink}" class="nav-link" id="nav-rescue">Rescue Services</a></li>
          <li><a href="${medicalLink}" class="nav-link" id="nav-medical">Medical Emergency</a></li>
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
