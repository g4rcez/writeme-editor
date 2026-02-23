/*
  * # Tasks\n\n- A\n  - B\n    - C\n      - D\n        - E\n      - F\n    - G\n  - H\n- I
  * # Tasks\n\n- A\n  \n  - B\n    \n    - C\n      \n      - D\n        \n        - E\n      - F\n    - G\n  - H\n- I
  * # Tasks\n\n- A\n  - B\n    - C\n      - D\n        - E\n      - F\n    - G\n  - H\n- I
  * # Tasks\n\n- A\n  \n  - B\n    \n    - C\n      \n      - D\n        \n        - E\n      - F\n    - G\n  - H\n- I
  */
export function elementFromString(value) {
  const wrappedValue = `<div>${value}</div>`;
  return new DOMParser().parseFromString(wrappedValue, "text/html").body;
}

export function escapeHTML(value) {
  return value?.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function extractElement(node) {
  const parent = node.parentElement;
  const prepend = parent.cloneNode();
  while (parent.firstChild && parent.firstChild !== node) {
    prepend.appendChild(parent.firstChild);
  }
  if (prepend.childNodes.length > 0) {
    parent.parentElement.insertBefore(prepend, parent);
  }
  parent.parentElement.insertBefore(node, parent);
  if (parent.childNodes.length === 0) {
    parent.remove();
  }
}

export function unwrapElement(node) {
  const parent = node.parentNode;
  while (node.firstChild) parent.insertBefore(node.firstChild, node);
  parent.removeChild(node);
}
