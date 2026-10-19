// Text is rendered and HTML-escaped by Java, never interpolated into executable code.
const messages = new Map(
  [...document.querySelectorAll("#ui-messages [data-message]")].map((element) => [
    element.dataset.message,
    element.textContent,
  ]),
);

export function message(key) {
  if (!messages.has(key)) throw new Error(`Missing interface message: ${key}`);
  return messages.get(key);
}
