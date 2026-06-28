(function () {
  const FOLDER_KEY = "kaoyanWrongQuestions.folders.v4";
  const LEGACY_FOLDER_KEYS = ["kaoyanWrongQuestions.folders.v3"];
  const DB_NAME = "kaoyanWrongQuestions.db";
  const DB_VERSION = 1;
  const STORE_NAME = "questions";
  const PAGE_SIZE = 5;
  const CATEGORIES = window.DEFAULT_CATEGORIES || ["数学", "英语", "政治", "408"];
  const seedQuestions = window.WRONG_QUESTIONS || [];
  const defaultSubjectFolders = window.DEFAULT_SUBJECT_FOLDERS || [
    { category: "数学", subject: "高等数学" },
    { category: "408", subject: "计算机组成原理" }
  ];
  const defaultTypeFolders = window.DEFAULT_TYPE_FOLDERS || [];

  const state = {
    category: "all",
    subject: "all",
    type: "all",
    customSubjectFolders: [],
    customTypeFolders: [],
    hiddenSubjects: [],
    hiddenTypes: [],
    customQuestions: [],
    deletedQuestionIds: [],
    pinnedQuestions: [],
    page: 1,
    paste: {
      questionImage: "",
      answerImage: ""
    }
  };

  const els = {
    category: document.querySelector("#categoryFilter"),
    subject: document.querySelector("#subjectFilter"),
    type: document.querySelector("#typeFilter"),
    tabs: document.querySelector("#subjectTabs"),
    stats: document.querySelector("#stats"),
    list: document.querySelector("#questionList"),
    pagination: document.querySelector("#pagination"),
    template: document.querySelector("#questionTemplate"),
    currentPath: document.querySelector("#currentPath"),
    manager: document.querySelector("#managerDialog"),
    openManager: document.querySelector("#openManager"),
    closeManager: document.querySelector("#closeManager"),
    subjectForm: document.querySelector("#subjectForm"),
    typeForm: document.querySelector("#typeForm"),
    subjectCategory: document.querySelector("#subjectCategory"),
    typeCategory: document.querySelector("#typeCategory"),
    typeSubject: document.querySelector("#typeSubject"),
    newSubject: document.querySelector("#newSubject"),
    newType: document.querySelector("#newType"),
    subjectList: document.querySelector("#subjectList"),
    typeList: document.querySelector("#typeList"),
    pasteDialog: document.querySelector("#pasteDialog"),
    openPasteDialog: document.querySelector("#openPasteDialog"),
    closePasteDialog: document.querySelector("#closePasteDialog"),
    pastePath: document.querySelector("#pastePath"),
    questionPasteBox: document.querySelector("#questionPasteBox"),
    answerPasteBox: document.querySelector("#answerPasteBox"),
    questionPreview: document.querySelector("#questionPreview"),
    answerPreview: document.querySelector("#answerPreview"),
    clearPaste: document.querySelector("#clearPaste"),
    savePastedQuestion: document.querySelector("#savePastedQuestion")
  };

  let db;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getAllFromDb() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function putQuestion(question) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const request = transaction.objectStore(STORE_NAME).put(question);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function deleteQuestionFromDb(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const request = transaction.objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

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

  function inferCategory(subject) {
    const exact = [...defaultSubjectFolders, ...state.customSubjectFolders].find((folder) => folder.subject === subject);
    if (exact) return exact.category;
    if (["高等数学", "线性代数", "概率论", "概率论与数理统计"].includes(subject)) return "数学";
    if (["计算机组成原理", "数据结构", "操作系统", "计算机网络"].includes(subject)) return "408";
    return state.category !== "all" ? state.category : "数学";
  }

  function addSubjectFolder(category, subject) {
    const cleanCategory = String(category || "").trim();
    const cleanSubject = String(subject || "").trim();
    if (!CATEGORIES.includes(cleanCategory) || !cleanSubject || subjectFolderExists(cleanCategory, cleanSubject)) return false;
    state.customSubjectFolders.push({ category: cleanCategory, subject: cleanSubject });
    return true;
  }

  function subjectFolderExists(category, subject) {
    return [...defaultSubjectFolders, ...state.customSubjectFolders].some((folder) => folder.category === category && folder.subject === subject);
  }

  function addTypeFolder(category, subject, type) {
    const cleanCategory = String(category || "").trim();
    const cleanSubject = String(subject || "").trim();
    const cleanType = String(type || "").trim();
    if (!CATEGORIES.includes(cleanCategory) || !cleanSubject || !cleanType || typeFolderExists(cleanCategory, cleanSubject, cleanType)) return false;
    state.customTypeFolders.push({ category: cleanCategory, subject: cleanSubject, type: cleanType });
    return true;
  }

  function typeFolderExists(category, subject, type) {
    return [...defaultTypeFolders, ...state.customTypeFolders].some((folder) => folder.category === category && folder.subject === subject && folder.type === type);
  }

  function loadFolders() {
    try {
      const stored = JSON.parse(localStorage.getItem(FOLDER_KEY) || "{}");
      state.customSubjectFolders = Array.isArray(stored.customSubjectFolders) ? stored.customSubjectFolders : [];
      state.customTypeFolders = Array.isArray(stored.customTypeFolders) ? stored.customTypeFolders : [];
      state.hiddenSubjects = Array.isArray(stored.hiddenSubjects) ? stored.hiddenSubjects : [];
      state.hiddenTypes = Array.isArray(stored.hiddenTypes) ? stored.hiddenTypes : [];
      state.deletedQuestionIds = Array.isArray(stored.deletedQuestionIds) ? stored.deletedQuestionIds : [];
      state.pinnedQuestions = Array.isArray(stored.pinnedQuestions) ? stored.pinnedQuestions : [];
    } catch (error) {
      state.customSubjectFolders = [];
      state.customTypeFolders = [];
      state.hiddenSubjects = [];
      state.hiddenTypes = [];
      state.deletedQuestionIds = [];
      state.pinnedQuestions = [];
    }

    if (state.customSubjectFolders.length === 0 && state.customTypeFolders.length === 0) {
      migrateLegacyFolders();
    }
  }

  function migrateLegacyFolders() {
    LEGACY_FOLDER_KEYS.forEach((key) => {
      try {
        const legacy = JSON.parse(localStorage.getItem(key) || "{}");
        (legacy.customSubjects || []).forEach((subject) => addSubjectFolder(inferCategory(subject), subject));
        (legacy.customTypeFolders || []).forEach((folder) => {
          const category = folder.category || inferCategory(folder.subject);
          addSubjectFolder(category, folder.subject);
          addTypeFolder(category, folder.subject, folder.type);
        });
        (legacy.customTypes || []).forEach((type) => {
          const subject = state.subject !== "all" ? state.subject : "高等数学";
          const category = inferCategory(subject);
          addSubjectFolder(category, subject);
          addTypeFolder(category, subject, type);
        });
        state.deletedQuestionIds = Array.isArray(legacy.deletedQuestionIds) ? legacy.deletedQuestionIds : state.deletedQuestionIds;
      } catch (error) {
        // Ignore malformed legacy data.
      }
    });
  }

  function saveFolders() {
    localStorage.setItem(
      FOLDER_KEY,
      JSON.stringify({
        customSubjectFolders: state.customSubjectFolders,
        customTypeFolders: state.customTypeFolders,
        hiddenSubjects: state.hiddenSubjects,
        hiddenTypes: state.hiddenTypes,
        deletedQuestionIds: state.deletedQuestionIds,
        pinnedQuestions: state.pinnedQuestions
      })
    );
  }

  function normalizeQuestion(item) {
    const category = item.category || inferCategory(item.subject);
    return { ...item, category };
  }

  function allQuestions() {
    const seed = seedQuestions.filter((item) => !state.deletedQuestionIds.includes(item.id)).map(normalizeQuestion);
    const custom = [...state.customQuestions]
      .filter((item) => !state.deletedQuestionIds.includes(item.id))
      .map(normalizeQuestion)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return [...seed, ...custom];
  }

  function questionById(id) {
    return allQuestions().find((item) => item.id === id);
  }

  function questionSubjectFolders() {
    return unique(allQuestions().map((item) => folderKey(item.category, item.subject))).map((key) => {
      const [category, subject] = key.split("|||");
      return { category, subject };
    });
  }

  function questionTypeFolders() {
    return unique(allQuestions().map((item) => typeFolderKey(item.category, item.subject, item.type))).map((key) => {
      const [category, subject, type] = key.split("|||");
      return { category, subject, type };
    });
  }

  function allSubjectFolders() {
    return [...defaultSubjectFolders, ...questionSubjectFolders(), ...state.customSubjectFolders].filter((folder, index, list) => {
      const key = folderKey(folder.category, folder.subject);
      return (
        CATEGORIES.includes(folder.category) &&
        index === list.findIndex((item) => folderKey(item.category, item.subject) === key) &&
        !state.hiddenSubjects.includes(key) &&
        !state.hiddenSubjects.includes(folder.subject)
      );
    });
  }

  function allTypeFolders() {
    return [...defaultTypeFolders, ...questionTypeFolders(), ...state.customTypeFolders].filter((folder, index, list) => {
      const key = typeFolderKey(folder.category, folder.subject, folder.type);
      return (
        CATEGORIES.includes(folder.category) &&
        index === list.findIndex((item) => typeFolderKey(item.category, item.subject, item.type) === key) &&
        !state.hiddenSubjects.includes(folderKey(folder.category, folder.subject)) &&
        !state.hiddenSubjects.includes(folder.subject) &&
        !state.hiddenTypes.includes(key) &&
        !state.hiddenTypes.includes(folder.type)
      );
    });
  }

  function visibleSubjectFolders() {
    const folders = allSubjectFolders();
    return state.category === "all" ? folders : folders.filter((folder) => folder.category === state.category);
  }

  function visibleSubjects() {
    return unique(visibleSubjectFolders().map((folder) => folder.subject));
  }

  function visibleTypeFolders() {
    const folders = allTypeFolders();
    return folders.filter((folder) => {
      return (state.category === "all" || folder.category === state.category) && (state.subject === "all" || folder.subject === state.subject);
    });
  }

  function visibleTypes() {
    return unique(visibleTypeFolders().map((folder) => folder.type));
  }

  function fillSelect(select, label, values, selectedValue) {
    select.innerHTML = "";
    select.append(new Option(label, "all"));
    values.forEach((value) => select.append(new Option(value, value)));
    select.value = values.includes(selectedValue) ? selectedValue : "all";
  }

  function fillCategorySelect(select, includeAll, selectedValue) {
    select.innerHTML = "";
    if (includeAll) select.append(new Option("全部大类", "all"));
    CATEGORIES.forEach((value) => select.append(new Option(value, value)));
    select.value = CATEGORIES.includes(selectedValue) || (includeAll && selectedValue === "all") ? selectedValue : includeAll ? "all" : "";
  }

  function currentPathText() {
    if (state.category === "all") return "全部错题";
    if (state.subject === "all") return state.category;
    if (state.type === "all") return `${state.category} / ${state.subject}`;
    return `${state.category} / ${state.subject} / ${state.type}`;
  }

  function canPasteIntoCurrentFolder() {
    return state.category !== "all" && state.subject !== "all" && state.type !== "all";
  }

  function filteredQuestions() {
    const items = allQuestions().filter((item) => {
      return (
        (state.category === "all" || item.category === state.category) &&
        (state.subject === "all" || item.subject === state.subject) &&
        (state.type === "all" || item.type === state.type)
      );
    });

    if (state.category !== "all" && state.subject !== "all" && state.type === "all") {
      const typeOrder = visibleTypes();
      return items.sort((a, b) => {
        const typeDiff = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
        if (typeDiff !== 0) return typeDiff;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    }
    return items;
  }

  function currentScopeKey() {
    if (state.category === "all" || state.subject === "all") return "";
    return scopeKey(state.category, state.subject, state.type);
  }

  function pinnedForCurrentScope() {
    const key = currentScopeKey();
    if (!key) return [];
    return state.pinnedQuestions
      .filter((pin) => pin.scope === key)
      .sort((a, b) => b.pinnedAt - a.pinnedAt)
      .map((pin) => ({ pin, question: questionById(pin.questionId) }))
      .filter((item) => item.question);
  }

  function pageItemsWithPins(items) {
    const pinned = state.page === 1 ? pinnedForCurrentScope().map((item) => ({ ...item.question, isPinnedCopy: true, pinId: item.pin.id })) : [];
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const regular = items.slice(start, start + PAGE_SIZE);
    return { displayItems: [...pinned, ...regular], totalPages, start };
  }

  function renderStats(items, subjectCount, typeCount) {
    els.stats.innerHTML = [
      ["错题", items.length],
      ["学科", subjectCount],
      ["目录", typeCount]
    ]
      .map(
        ([label, value]) => `
          <div class="stat-card">
            <strong>${value}</strong>
            <span>${label}</span>
          </div>
        `
      )
      .join("");
  }

  function renderTabs() {
    const tabs = ["all", ...CATEGORIES];
    els.tabs.innerHTML = "";
    tabs.forEach((category) => {
      const button = document.createElement("button");
      button.className = "tab-button";
      button.type = "button";
      button.textContent = category === "all" ? "全部" : category;
      button.classList.toggle("is-active", state.category === category);
      button.addEventListener("click", () => {
        state.category = category;
        state.subject = "all";
        state.type = "all";
        state.page = 1;
        render();
      });
      els.tabs.append(button);
    });
  }

  function renderModuleList(container, folders, labeler, removeHandler) {
    container.innerHTML = "";
    folders.forEach((folder) => {
      const chip = document.createElement("span");
      chip.className = "module-chip";
      chip.append(document.createTextNode(labeler(folder)));
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `删除 ${labeler(folder)}`);
      button.textContent = "×";
      button.addEventListener("click", () => removeHandler(folder));
      chip.append(button);
      container.append(chip);
    });
  }

  function renderSubjectOptions() {
    const subjectFolders = state.category === "all" ? allSubjectFolders() : allSubjectFolders().filter((folder) => folder.category === state.category);

    els.subjectCategory.innerHTML = "";
    els.subjectCategory.append(new Option("选择大类", ""));
    CATEGORIES.forEach((category) => els.subjectCategory.append(new Option(category, category)));
    els.subjectCategory.value = CATEGORIES.includes(els.subjectCategory.value) ? els.subjectCategory.value : state.category !== "all" ? state.category : "";

    const previousTypeCategory = els.typeCategory.value;
    els.typeCategory.innerHTML = "";
    els.typeCategory.append(new Option("选择大类", ""));
    CATEGORIES.forEach((category) => els.typeCategory.append(new Option(category, category)));
    els.typeCategory.value = CATEGORIES.includes(previousTypeCategory) ? previousTypeCategory : state.category !== "all" ? state.category : "";

    const selectedTypeCategory = els.typeCategory.value;
    const typeSubjectFolders = selectedTypeCategory ? allSubjectFolders().filter((folder) => folder.category === selectedTypeCategory) : [];
    els.typeSubject.innerHTML = "";
    els.typeSubject.append(new Option("选择学科", ""));
    typeSubjectFolders.forEach((folder) => els.typeSubject.append(new Option(folder.subject, folder.subject)));
    els.typeSubject.value = state.subject !== "all" && subjectFolders.some((folder) => folder.subject === state.subject) ? state.subject : "";
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

  function renderQuestion(item, index) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.classList.toggle("is-pinned-copy", Boolean(item.isPinnedCopy));
    node.querySelector("h3").textContent = item.title || `第 ${index + 1} 题`;

    const meta = node.querySelector(".meta-row");
    [item.category, item.subject, item.type, item.isPinnedCopy ? "置顶" : ""].filter(Boolean).forEach((value) => {
      const pill = document.createElement("span");
      pill.className = value === "置顶" ? "meta pin-meta" : "meta";
      pill.textContent = value;
      meta.append(pill);
    });

    const actions = node.querySelector(".question-actions");
    if (item.isPinnedCopy) {
      const unpinButton = document.createElement("button");
      unpinButton.className = "pin-button is-active";
      unpinButton.type = "button";
      unpinButton.title = "取消置顶";
      unpinButton.setAttribute("aria-label", "取消置顶");
      unpinButton.addEventListener("click", () => unpinQuestion(item.pinId));
      actions.append(unpinButton);
    } else {
      const pinButton = document.createElement("button");
      pinButton.className = "pin-button";
      pinButton.type = "button";
      pinButton.title = "置顶到当前层级";
      pinButton.setAttribute("aria-label", "置顶到当前层级");
      pinButton.addEventListener("click", () => pinQuestion(item.id));
      actions.append(pinButton);

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-question";
      deleteButton.type = "button";
      deleteButton.textContent = "删除";
      deleteButton.addEventListener("click", () => deleteQuestion(item.id, item.title || `第 ${index + 1} 题`));
      actions.append(deleteButton);
    }

    renderMedia(node.querySelector(".question-media"), item.questionImages, `${item.title || "错题"} 题目截图`);

    const answer = node.querySelector(".answer-content");
    const answerMedia = document.createElement("div");
    answerMedia.className = "media-block";
    answer.append(answerMedia);
    renderMedia(answerMedia, item.answerImages, `${item.title || "错题"} 答案解析截图`);

    return node;
  }

  function renderTypeDivider(type) {
    const divider = document.createElement("div");
    divider.className = "type-divider";
    divider.textContent = type || "未分类";
    return divider;
  }

  function renderPastePreviews() {
    renderPreview(els.questionPreview, state.paste.questionImage);
    renderPreview(els.answerPreview, state.paste.answerImage);
  }

  function renderPreview(container, imageData) {
    container.innerHTML = "";
    if (!imageData) return;
    container.append(createImage(imageData, "已粘贴截图预览"));
  }

  function resetPaste() {
    state.paste.questionImage = "";
    state.paste.answerImage = "";
    renderPastePreviews();
  }

  function render() {
    if (state.category === "all") {
      state.subject = "all";
      state.type = "all";
    }
    if (state.subject === "all") {
      state.type = "all";
    }
    const subjectFolders = visibleSubjectFolders();
    const typeFolders = visibleTypeFolders();
    const subjects = visibleSubjects();
    const types = visibleTypes();
    if (state.subject !== "all" && !subjects.includes(state.subject)) state.subject = "all";
    if (state.type !== "all" && !types.includes(state.type)) state.type = "all";

    const items = filteredQuestions();
    const { displayItems, totalPages, start } = pageItemsWithPins(items);

    fillCategorySelect(els.category, true, state.category);
    fillSelect(els.subject, "全部学科", subjects, state.subject);
    fillSelect(els.type, "全部目录", types, state.type);
    els.subject.disabled = state.category === "all";
    els.type.disabled = state.category === "all" || state.subject === "all";
    renderSubjectOptions();
    renderTabs();
    renderStats(items, subjectFolders.length, types.length);
    renderModuleList(els.subjectList, allSubjectFolders(), (folder) => `${folder.category} / ${folder.subject}`, deleteSubject);
    renderModuleList(els.typeList, allTypeFolders(), (folder) => `${folder.category} / ${folder.subject} / ${folder.type}`, deleteType);

    els.currentPath.textContent = currentPathText();
    els.openPasteDialog.disabled = !canPasteIntoCurrentFolder();
    els.openPasteDialog.title = canPasteIntoCurrentFolder() ? "在当前目录新增错题" : "请先选择大类、学科和题型目录";

    els.list.innerHTML = "";
    if (items.length === 0 && displayItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = canPasteIntoCurrentFolder() ? "当前目录还没有错题，点击右上角 + 后粘贴题目和解析截图。" : "请在左侧选择具体大类、学科和题型目录后添加错题。";
      els.list.append(empty);
      renderPagination(items.length, totalPages);
      return;
    }

    displayItems.forEach((item, index) => {
      const previous = displayItems[index - 1] || items[start + index - 1];
      const shouldDivide = !item.isPinnedCopy && state.category !== "all" && state.subject !== "all" && state.type === "all" && (!previous || previous.type !== item.type);
      if (shouldDivide) els.list.append(renderTypeDivider(item.type));
      els.list.append(renderQuestion(item, item.isPinnedCopy ? 0 : start + index));
    });
    renderPagination(items.length, totalPages);
  }

  function renderPagination(totalItems, totalPages) {
    els.pagination.innerHTML = "";
    if (totalItems <= PAGE_SIZE) return;

    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "上一页";
    prev.disabled = state.page <= 1;
    prev.addEventListener("click", () => {
      state.page = Math.max(1, state.page - 1);
      render();
    });

    const label = document.createElement("span");
    label.textContent = `第 ${state.page} / ${totalPages} 页，共 ${totalItems} 道`;

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "下一页";
    next.disabled = state.page >= totalPages;
    next.addEventListener("click", () => {
      state.page = Math.min(totalPages, state.page + 1);
      render();
    });

    els.pagination.append(prev, label, next);

    if (state.category !== "all" && state.subject !== "all" && state.type === "all") {
      const jumpForm = document.createElement("form");
      jumpForm.className = "page-jump";
      jumpForm.setAttribute("aria-label", "跳转页码");

      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = String(totalPages);
      input.value = String(state.page);
      input.inputMode = "numeric";
      input.setAttribute("aria-label", "页码");

      const button = document.createElement("button");
      button.type = "submit";
      button.textContent = "跳转";

      jumpForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const target = Number(input.value);
        if (!Number.isInteger(target) || target < 1 || target > totalPages) {
          window.alert(`请输入 1 到 ${totalPages} 之间的页码。`);
          return;
        }
        state.page = target;
        render();
      });

      jumpForm.append(input, button);
      els.pagination.append(jumpForm);
    }
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

  function openPasteDialog() {
    if (!canPasteIntoCurrentFolder()) {
      window.alert("请先在左侧选择具体的大类、学科和题型目录。");
      return;
    }
    resetPaste();
    els.pastePath.textContent = `保存到：${currentPathText()}`;
    openDialog(els.pasteDialog);
    els.questionPasteBox.focus();
  }

  function readPastedImage(event, targetKey) {
    const items = [...(event.clipboardData && event.clipboardData.items ? event.clipboardData.items : [])];
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    event.preventDefault();
    const file = imageItem.getAsFile();
    const reader = new FileReader();
    reader.onload = () => {
      state.paste[targetKey] = reader.result;
      renderPastePreviews();
    };
    reader.readAsDataURL(file);
  }

  async function savePastedQuestion() {
    if (!state.paste.questionImage || !state.paste.answerImage) {
      window.alert("请先分别粘贴题目截图和解析截图。");
      return;
    }

    const folderQuestions = allQuestions().filter((item) => item.category === state.category && item.subject === state.subject && item.type === state.type);
    const createdAt = Date.now();
    const question = {
      id: `custom-${createdAt}`,
      category: state.category,
      subject: state.subject,
      type: state.type,
      title: `第 ${folderQuestions.length + 1} 题`,
      createdAt,
      questionImages: [state.paste.questionImage],
      answerImages: [state.paste.answerImage]
    };

    addSubjectFolder(state.category, state.subject);
    addTypeFolder(state.category, state.subject, state.type);
    state.hiddenTypes = state.hiddenTypes.filter((item) => item !== typeFolderKey(state.category, state.subject, state.type));
    await putQuestion(question);
    state.customQuestions.push(question);
    state.page = Math.ceil((folderQuestions.length + 1) / PAGE_SIZE);
    resetPaste();
    closeDialog(els.pasteDialog);
    saveFolders();
    render();
  }

  function pinQuestion(questionId) {
    const scope = currentScopeKey();
    if (!scope) {
      window.alert("请先进入具体学科层级后再置顶。");
      return;
    }
    const existing = state.pinnedQuestions.find((pin) => pin.scope === scope && pin.questionId === questionId);
    if (existing) {
      existing.pinnedAt = Date.now();
      state.page = 1;
      saveFolders();
      render();
      return;
    }
    state.pinnedQuestions.push({
      id: `pin-${Date.now()}`,
      questionId,
      scope,
      pinnedAt: Date.now()
    });
    state.page = 1;
    saveFolders();
    render();
  }

  function unpinQuestion(pinId) {
    state.pinnedQuestions = state.pinnedQuestions.filter((pin) => pin.id !== pinId);
    saveFolders();
    render();
  }

  async function deleteSubject(folder) {
    const usedCount = allQuestions().filter((item) => item.category === folder.category && item.subject === folder.subject).length;
    const message =
      usedCount > 0
        ? `确定删除“${folder.category} / ${folder.subject}”吗？已有 ${usedCount} 道错题使用它，这些错题会改为“未分类学科”。`
        : `确定删除“${folder.category} / ${folder.subject}”吗？`;

    if (!window.confirm(message)) return;

    state.customSubjectFolders = state.customSubjectFolders.filter((item) => !(item.category === folder.category && item.subject === folder.subject));
    state.customTypeFolders = state.customTypeFolders.filter((item) => !(item.category === folder.category && item.subject === folder.subject));
    state.pinnedQuestions = state.pinnedQuestions.filter((pin) => !pin.scope.startsWith(`${folder.category}|||${folder.subject}|||`));
    state.hiddenSubjects.push(folderKey(folder.category, folder.subject));

    if (usedCount > 0) {
      await updateQuestions((item) => (item.category === folder.category && item.subject === folder.subject ? { ...item, subject: "未分类学科" } : item));
      addSubjectFolder(folder.category, "未分类学科");
    }

    if (state.category === folder.category && state.subject === folder.subject) state.subject = "all";
    state.type = "all";
    state.page = 1;
    saveFolders();
    render();
  }

  async function deleteType(folder) {
    const usedCount = allQuestions().filter((item) => item.category === folder.category && item.subject === folder.subject && item.type === folder.type).length;
    const message =
      usedCount > 0
        ? `确定删除“${folder.category} / ${folder.subject} / ${folder.type}”目录吗？已有 ${usedCount} 道错题使用它，这些错题会改为“未分类”。`
        : `确定删除“${folder.category} / ${folder.subject} / ${folder.type}”目录吗？`;

    if (!window.confirm(message)) return;

    state.customTypeFolders = state.customTypeFolders.filter((item) => !(item.category === folder.category && item.subject === folder.subject && item.type === folder.type));
    state.pinnedQuestions = state.pinnedQuestions.filter((pin) => pin.scope !== typeFolderKey(folder.category, folder.subject, folder.type));
    state.hiddenTypes.push(typeFolderKey(folder.category, folder.subject, folder.type));

    if (usedCount > 0) {
      await updateQuestions((item) => (item.category === folder.category && item.subject === folder.subject && item.type === folder.type ? { ...item, type: "未分类" } : item));
      addTypeFolder(folder.category, folder.subject, "未分类");
    }

    if (state.category === folder.category && state.subject === folder.subject && state.type === folder.type) state.type = "all";
    state.page = 1;
    saveFolders();
    render();
  }

  async function updateQuestions(mapper) {
    const updated = state.customQuestions.map((item) => mapper(normalizeQuestion(item)));
    await Promise.all(updated.map((item) => putQuestion(item)));
    state.customQuestions = updated;
  }

  async function deleteQuestion(id, title) {
    if (!window.confirm(`确定删除错题“${title}”吗？删除后不会在页面中显示。`)) return;

    state.customQuestions = state.customQuestions.filter((item) => item.id !== id);
    state.deletedQuestionIds.push(id);
    state.pinnedQuestions = state.pinnedQuestions.filter((pin) => pin.questionId !== id);
    await deleteQuestionFromDb(id);
    saveFolders();
    render();
  }

  function bind() {
    els.category.addEventListener("change", (event) => {
      state.category = event.target.value;
      state.subject = "all";
      state.type = "all";
      state.page = 1;
      render();
    });
    els.subject.addEventListener("change", (event) => {
      state.subject = event.target.value;
      state.type = "all";
      state.page = 1;
      render();
    });
    els.type.addEventListener("change", (event) => {
      state.type = event.target.value;
      state.page = 1;
      render();
    });
    els.openManager.addEventListener("click", () => openDialog(els.manager));
    els.closeManager.addEventListener("click", () => closeDialog(els.manager));
    els.manager.addEventListener("click", (event) => {
      if (event.target === els.manager) closeDialog(els.manager);
    });
    els.typeCategory.addEventListener("change", renderSubjectOptions);
    els.openPasteDialog.addEventListener("click", openPasteDialog);
    els.closePasteDialog.addEventListener("click", () => closeDialog(els.pasteDialog));
    els.pasteDialog.addEventListener("click", (event) => {
      if (event.target === els.pasteDialog) closeDialog(els.pasteDialog);
    });
    els.questionPasteBox.addEventListener("paste", (event) => readPastedImage(event, "questionImage"));
    els.answerPasteBox.addEventListener("paste", (event) => readPastedImage(event, "answerImage"));
    els.clearPaste.addEventListener("click", resetPaste);
    els.savePastedQuestion.addEventListener("click", () => {
      savePastedQuestion().catch(() => window.alert("保存失败，可能是浏览器存储空间不足。"));
    });

    els.subjectForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const category = els.subjectCategory.value.trim();
      const subject = els.newSubject.value.trim();
      if (!category) {
        window.alert("请先选择学科归属于哪个大类。");
        return;
      }
      addSubjectFolder(category, subject);
      state.hiddenSubjects = state.hiddenSubjects.filter((item) => item !== folderKey(category, subject));
      els.newSubject.value = "";
      state.page = 1;
      saveFolders();
      render();
    });

    els.typeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const category = els.typeCategory.value.trim();
      const subject = els.typeSubject.value.trim();
      const type = els.newType.value.trim();
      if (!category || !subject) {
        window.alert("请先选择这个目录归属于哪个大类和学科。");
        return;
      }
      addTypeFolder(category, subject, type);
      state.hiddenTypes = state.hiddenTypes.filter((item) => item !== typeFolderKey(category, subject, type));
      els.newType.value = "";
      state.page = 1;
      saveFolders();
      render();
    });
  }

  async function init() {
    loadFolders();
    db = await openDb();
    state.customQuestions = (await getAllFromDb()).map(normalizeQuestion);
    await Promise.all(state.customQuestions.map((item) => putQuestion(item)));
    bind();
    render();
  }

  init().catch(() => {
    window.alert("错题本初始化失败，请确认浏览器允许本地存储。");
  });
})();
