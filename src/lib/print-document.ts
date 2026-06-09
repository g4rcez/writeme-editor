type PrintDocumentOptions = {
  title?: string;
};

export function printDocument(options: PrintDocumentOptions = {}): void {
  const previousTitle = document.title;
  const printTitle = options.title?.trim();

  if (printTitle) {
    document.title = printTitle;
  }

  document.documentElement.classList.add("writeme-is-printing");

  const restore = (): void => {
    document.documentElement.classList.remove("writeme-is-printing");
    document.title = previousTitle;
  };

  window.addEventListener("afterprint", restore, { once: true });

  try {
    window.print();
  } catch (error) {
    restore();
    throw error;
  }
}
