import { GOOGLE_FORM } from "../data/form";

// Contact form → Google Forms. The site keeps its own form; on submit we post
// the values to the Google Form's formResponse endpoint. Google doesn't allow
// reading the reply cross-origin (no-cors), so a completed request counts as
// sent and only a network failure shows the error.
const form = document.querySelector<HTMLFormElement>("[data-contact-form]");
if (form) {
  const submitBtn = form.querySelector<HTMLButtonElement>("[data-submit]")!;
  const errorEl = form.querySelector<HTMLElement>("[data-form-error]")!;
  const configured = GOOGLE_FORM.formId && Object.values(GOOGLE_FORM.entries).every(Boolean);

  const showThanks = () => {
    form.hidden = true;
    document.querySelector<HTMLElement>("[data-thanks]")!.hidden = false;
  };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const values = new FormData(form);

    // Honeypot filled → a bot. Pretend it worked, send nothing.
    if (values.get("_gotcha")) { showThanks(); return; }

    if (!configured) {
      console.warn("Google Form not configured in src/data/form.ts; the submission was not sent.");
      showThanks();
      return;
    }

    const body = new URLSearchParams();
    for (const [field, entry] of Object.entries(GOOGLE_FORM.entries)) {
      body.append(entry, String(values.get(field) ?? ""));
    }

    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "A enviar…";
    try {
      await fetch(`https://docs.google.com/forms/d/e/${GOOGLE_FORM.formId}/formResponse`, {
        method: "POST",
        mode: "no-cors",
        body,
      });
      showThanks();
    } catch {
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar";
    }
  });
}
