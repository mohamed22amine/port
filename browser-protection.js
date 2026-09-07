(function installBrowserProtection() {
  const blockedShortcuts = new Set([
    "F12",
    "Ctrl+Shift+I",
    "Ctrl+Shift+J",
    "Ctrl+Shift+C",
    "Ctrl+U",
    "Ctrl+S",
    "Ctrl+P"
  ]);

  function shortcutName(event) {
    const modifiers = [];
    if (event.ctrlKey || event.metaKey) modifiers.push("Ctrl");
    if (event.shiftKey) modifiers.push("Shift");
    if (event.altKey) modifiers.push("Alt");
    modifiers.push(event.key.toUpperCase());
    return modifiers.join("+");
  }

  document.addEventListener("keydown", (event) => {
    const isWindowsScreenshotShortcut = event.metaKey && event.shiftKey && event.key.toLowerCase() === "s";

    if (blockedShortcuts.has(shortcutName(event)) || isWindowsScreenshotShortcut) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, true);
  });
})();