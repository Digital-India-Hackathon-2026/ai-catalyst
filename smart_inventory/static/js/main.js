// Smart Inventory System Frontend Interactions

document.addEventListener("DOMContentLoaded", () => {
    // 1. Toast Alerts Auto-Dismiss
    const toasts = document.querySelectorAll(".toast");
    toasts.forEach(toast => {
        // Auto dismiss after 4 seconds
        setTimeout(() => {
            dismissToast(toast);
        }, 4000);

        // Manual dismiss on click
        const closeBtn = toast.querySelector(".toast-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                dismissToast(toast);
            });
        }
    });

    // 2. Auto-Submit Filter Dropdown on Change
    const filterSelect = document.getElementById("category-filter");
    if (filterSelect) {
        filterSelect.addEventListener("change", () => {
            const form = filterSelect.closest("form");
            if (form) form.submit();
        });
    }

    // 3. Delete Confirmation Modal
    const deleteForms = document.querySelectorAll(".delete-med-form");
    const confirmModal = document.getElementById("delete-confirm-modal");
    
    if (confirmModal) {
        let formToSubmit = null;
        const confirmBtn = document.getElementById("modal-confirm-delete");
        const cancelBtn = document.getElementById("modal-cancel-delete");
        const modalClose = confirmModal.querySelector(".modal-close");
        const medNameSpan = document.getElementById("modal-med-name");

        deleteForms.forEach(form => {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                formToSubmit = form;
                
                // Fetch medicine name from data attribute
                const medName = form.getAttribute("data-med-name") || "this medicine";
                if (medNameSpan) medNameSpan.textContent = medName;
                
                confirmModal.classList.add("active");
            });
        });

        const closeModal = () => {
            confirmModal.classList.remove("active");
            formToSubmit = null;
        };

        if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
        if (modalClose) modalClose.addEventListener("click", closeModal);
        
        if (confirmBtn) {
            confirmBtn.addEventListener("click", () => {
                if (formToSubmit) {
                    formToSubmit.submit();
                }
                closeModal();
            });
        }
    }
    
    // 4. View Details Modal
    const viewButtons = document.querySelectorAll(".view-med-btn");
    const viewModal = document.getElementById("view-details-modal");
    
    if (viewModal) {
        const modalClose = viewModal.querySelector(".modal-close");
        const cancelBtn = viewModal.querySelector(".btn-close-modal");
        
        viewButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                // Populate details from data attributes
                document.getElementById("det-name").textContent = btn.getAttribute("data-name") || "";
                document.getElementById("det-category").textContent = btn.getAttribute("data-category") || "";
                document.getElementById("det-quantity").textContent = btn.getAttribute("data-quantity") + " " + btn.getAttribute("data-unit") || "";
                document.getElementById("det-batch").textContent = btn.getAttribute("data-batch") || "";
                document.getElementById("det-manufacturer").textContent = btn.getAttribute("data-manufacturer") || "";
                document.getElementById("det-expiry").textContent = btn.getAttribute("data-expiry") || "";
                document.getElementById("det-min-stock").textContent = btn.getAttribute("data-min-stock") + " " + btn.getAttribute("data-unit") || "";
                document.getElementById("det-status").textContent = btn.getAttribute("data-status") || "";
                
                // Style status text
                const statusSpan = document.getElementById("det-status");
                statusSpan.className = ""; // clear previous classes
                const status = btn.getAttribute("data-status");
                if (status === "Available") statusSpan.style.color = "var(--color-available)";
                else if (status === "Low Stock") statusSpan.style.color = "var(--color-low)";
                else if (status === "Expiring Soon") statusSpan.style.color = "var(--color-expiring)";
                else if (status === "Expired") statusSpan.style.color = "var(--color-expired)";
                statusSpan.style.fontWeight = "bold";

                viewModal.classList.add("active");
            });
        });
        
        const closeViewModal = () => {
            viewModal.classList.remove("active");
        };
        
        if (cancelBtn) cancelBtn.addEventListener("click", closeViewModal);
        if (modalClose) modalClose.addEventListener("click", closeViewModal);
    }
});

function dismissToast(toast) {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    setTimeout(() => {
        toast.remove();
    }, 300);
}
