const getScrollContainer = () =>
  document.getElementById("main-scroll-container") || window;

export const getScrollY = () => {
  const container = getScrollContainer();
  return container === window
    ? window.scrollY
    : (container as HTMLElement).scrollTop;
};

export const setScrollY = (y: number) => {
  const container = getScrollContainer();
  if (container === window) {
    window.scrollTo(0, y);
  } else {
    (container as HTMLElement).scrollTop = y;
  }
};
