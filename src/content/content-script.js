(() => {
  const pageSnapshot = {
    title: document.title,
    url: window.location.href,
  };

  console.debug('Intent Mode Browser local page snapshot:', pageSnapshot);
})();
