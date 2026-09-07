const pdfButton = document.getElementById("save-pdf-btn");
const printButton = document.getElementById("print-resume-btn");

if (printButton) {
  printButton.addEventListener("click", () => window.print());
}

if (pdfButton) {
  pdfButton.addEventListener("click", () => {
    const originalHTML = pdfButton.innerHTML;
    pdfButton.innerHTML = `
      <svg class="spin-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      <span>Saving PDF...</span>
    `;
    pdfButton.disabled = true;
    window.scrollTo(0, 0);

    const element = document.querySelector(".resume-page");
    const noPrintEls = document.querySelectorAll(".no-print");
    const prevDisplays = [];
    noPrintEls.forEach((el, index) => {
      prevDisplays[index] = el.style.display;
      el.style.setProperty("display", "none", "important");
    });

    const emailLink = document.getElementById("email-contact-link");
    const originalEmailHref = emailLink ? emailLink.getAttribute("href") : null;
    if (emailLink) {
      emailLink.setAttribute("href", "https://mail.google.com/mail/?view=cm&fs=1&to=mohamed.amine.hamdani.dev@gmail.com");
    }

    const options = {
      margin: [10, 12, 10, 12],
      filename: "Hamdani_Mohamed_Amine_Resume.pdf",
      image: { type: "jpeg", quality: 0.98 },
      enableLinks: true,
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: [".project-item", ".exp-block", ".edu-block", ".section-title", ".skills-grid > div", ".languages-row", ".lang-item", ".resume-header"]
      }
    };

    const cleanup = () => {
      noPrintEls.forEach((el, index) => {
        el.style.display = prevDisplays[index];
      });
      if (emailLink && originalEmailHref) emailLink.setAttribute("href", originalEmailHref);
      pdfButton.innerHTML = originalHTML;
      pdfButton.disabled = false;
    };

    if (typeof html2pdf === "undefined") {
      cleanup();
      window.print();
      return;
    }

    html2pdf().set(options).from(element).save().then(cleanup).catch(() => {
      cleanup();
      window.print();
    });
  });
}