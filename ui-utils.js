(function () {
  function unique(values) {
    return [...new Set(values.map((value) => value && String(value).trim()).filter(Boolean))];
  }

  function folderKey(category, subject) {
    return `${category}|||${subject}`;
  }

  function typeFolderKey(category, subject, type) {
    return `${category}|||${subject}|||${type}`;
  }

  function scopeKey(category, subject, type) {
    return type === "all" ? `${category}|||${subject}|||*` : typeFolderKey(category, subject, type);
  }

  function createImage(path, label) {
    const image = document.createElement("img");
    image.className = "shot";
    image.src = path;
    image.alt = label;
    image.loading = "lazy";
    image.onerror = () => {
      const placeholder = document.createElement("div");
      placeholder.className = "missing-shot";
      placeholder.textContent = "截图无法显示";
      image.replaceWith(placeholder);
    };
    return image;
  }

  function renderMedia(container, paths, label) {
    container.innerHTML = "";
    if (!paths || paths.length === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "missing-shot";
      placeholder.textContent = "暂无截图";
      container.append(placeholder);
      return;
    }
    paths.forEach((path, index) => {
      container.append(createImage(path, `${label} ${index + 1}`));
    });
  }

  function renderPreview(container, imageData) {
    container.innerHTML = "";
    if (!imageData) return;
    container.append(createImage(imageData, "已粘贴截图预览"));
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    dialog.close();
  }

  window.WQUtils = {
    closeDialog,
    createImage,
    folderKey,
    openDialog,
    renderMedia,
    renderPreview,
    scopeKey,
    typeFolderKey,
    unique
  };
})();
