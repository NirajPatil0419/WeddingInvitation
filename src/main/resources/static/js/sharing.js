import { message as uiText } from "./messages.js";

export function setupSharing() {
  const button = document.querySelector("[data-share-invitation]");
  const status = document.querySelector("[data-share-status]");
  if (!button) return;
  let busy = false;

  function announce(message) {
    if (status) status.textContent = message;
  }

  async function copyLink(url) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        return true;
      } catch {
        /* Try the compatible copy action below. */
      }
    }

    const field = document.createElement("textarea");
    field.value = url;
    field.setAttribute("readonly", "");
    field.setAttribute("aria-label", uiText("jsInvitationLink"));
    field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      /* Show manual instructions. */
    }
    field.remove();
    button.focus({ preventScroll: true });
    return copied;
  }

  button.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    button.setAttribute("aria-busy", "true");
    const url = new URL(
      document.querySelector("link[rel='canonical']")?.href || window.location.href,
    );
    url.hash = "";
    announce("");
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: document.title,
            text: uiText("jsShareText"),
            url: url.href,
          });
          announce(uiText("jsShareThanks"));
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      const copied = await copyLink(url.href);
      announce(copied ? uiText("jsLinkCopied") : uiText("jsCopyManually"));
    } finally {
      busy = false;
      button.removeAttribute("aria-busy");
    }
  });
  button.hidden = false;
}
