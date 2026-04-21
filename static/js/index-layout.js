document.addEventListener("DOMContentLoaded", function () {
  const showIsoButton = document.getElementById("show-iso-list");

  if (showIsoButton) {
    const downloadLinkModalElement = document.getElementById(
      "download-link-modal"
    );
    const isoList = document.getElementById("iso-list");

    if (downloadLinkModalElement) {
      // If modal exists, use it
      const downloadLinkModal = new bootstrap.Modal(downloadLinkModalElement);
      showIsoButton.addEventListener("click", function () {
        downloadLinkModal.show();
      });

      downloadLinkModalElement.addEventListener(
        "show.bs.modal",
        function (event) {
          if (typeof loadIsoInfo === "function") {
            loadIsoInfo();
          } else {
            console.error(
              "loadIsoInfo function not found. Make sure main.js is loaded."
            );
            const modalBody = document.getElementById(
              "download-link-modal-body"
            );
            if (modalBody) {
              modalBody.innerHTML =
                '<div class="alert alert-danger">Could not load download links. Script error.</div>';
            }
          }
        }
      );
    } else if (isoList) {
      // Otherwise, just toggle the list
      showIsoButton.addEventListener("click", function () {
        if (isoList.style.display === "none") {
          isoList.style.display = "block";
        } else {
          isoList.style.display = "none";
        }
      });
    }
  }
});
