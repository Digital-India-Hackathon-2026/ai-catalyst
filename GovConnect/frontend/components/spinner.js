// Reusable Loading Spinner Component

export function getSpinnerHTML(message = "Loading module data...") {
  return `
    <div class="spinner-container">
      <div class="spinner"></div>
      <p style="font-size: 0.9rem; color: var(--text-secondary);">${message}</p>
    </div>
  `;
}
