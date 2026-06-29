(function () {
  const FOLDER_KEY = "kaoyanWrongQuestions.folders.v4";
  const LEGACY_FOLDER_KEYS = ["kaoyanWrongQuestions.folders.v3"];
  const DB_NAME = "kaoyanWrongQuestions.db";
  const AUTH_KEY = "kaoyanWrongQuestions.auth.v1";
  const SESSION_KEY = "kaoyanWrongQuestions.session.v1";
  const SOURCE_KEY = "kaoyanWrongQuestions.source.v1";
  const AVATAR_KEY = "kaoyanWrongQuestions.avatar.v1";
  const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
  const DEFAULT_AVATAR_SRC =
    "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2088%2088'%3E%3Crect%20width='88'%20height='88'%20rx='16'%20fill='%23f7fbf7'/%3E%3Ccircle%20cx='44'%20cy='34'%20r='16'%20fill='%2388a892'/%3E%3Cpath%20d='M18%2075c4-18%2019-28%2026-28s22%2010%2026%2028'%20fill='%2388a892'/%3E%3Crect%20x='.5'%20y='.5'%20width='87'%20height='87'%20rx='15.5'%20fill='none'%20stroke='%23d7e2d8'/%3E%3C/svg%3E";
  const DB_VERSION = 1;
  const BACKUP_VERSION = 3;
  const STORE_NAME = "questions";
  const PAGE_SIZE = 5;
  const DEFAULT_CATEGORIES = window.DEFAULT_CATEGORIES || ["数学", "英语", "政治", "408"];
  let CATEGORIES = [...DEFAULT_CATEGORIES];
  const seedQuestions = window.WRONG_QUESTIONS || [];
  const defaultSubjectFolders = window.DEFAULT_SUBJECT_FOLDERS || [
    { category: "数学", subject: "高等数学" },
    { category: "408", subject: "计算机组成原理" }
  ];
  const defaultTypeFolders = window.DEFAULT_TYPE_FOLDERS || [];
  const initialDefaultSubjectFolders = defaultSubjectFolders.map((folder) => ({ ...folder }));
  const initialDefaultTypeFolders = defaultTypeFolders.map((folder) => ({ ...folder }));

  ensureAvatarControls();

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
    avatar: "",
    subjectOrders: {},
    typeOrders: {},
    page: 1,
    showOwnerIds: false,
    importMode: "overwrite",
    paste: {
      questionImages: [],
      answerImages: [],
      note: ""
    }
  };

  function ensureAvatarControls() {
    const profileMark = document.querySelector(".profile-mark");
    if (!profileMark) return;

    let avatarButton = document.querySelector("#avatarButton");
    if (!avatarButton) {
      avatarButton = document.createElement("button");
      avatarButton.className = "avatar-button";
      avatarButton.id = "avatarButton";
      avatarButton.type = "button";
      avatarButton.setAttribute("aria-label", "更换个人头像");
      avatarButton.title = "更换个人头像";

      const image = document.createElement("img");
      image.id = "profileAvatar";
      image.alt = "个人头像";

      avatarButton.append(image);
      const legacyImage = profileMark.querySelector(":scope > img");
      if (legacyImage) legacyImage.replaceWith(avatarButton);
      else profileMark.prepend(avatarButton);
    }

    if (!document.querySelector("#profileAvatar")) {
      const image = document.createElement("img");
      image.id = "profileAvatar";
      image.alt = "个人头像";
      image.hidden = true;
      avatarButton.append(image);
    }

    if (!document.querySelector("#avatarFileInput")) {
      const input = document.createElement("input");
      input.id = "avatarFileInput";
      input.type = "file";
      input.accept = "image/jpeg,image/png,.jpg,.jpeg,.png";
      input.hidden = true;
      profileMark.append(input);
    }
  }

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
    categoryList: document.querySelector("#categoryList"),
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
    questionImageInput: document.querySelector("#questionImageInput"),
    answerImageInput: document.querySelector("#answerImageInput"),
    pasteNote: document.querySelector("#pasteNote"),
    clearPaste: document.querySelector("#clearPaste"),
    savePastedQuestion: document.querySelector("#savePastedQuestion"),
    authScreen: document.querySelector("#authScreen"),
    authForm: document.querySelector("#authForm"),
    authTitle: document.querySelector("#authTitle"),
    authHint: document.querySelector("#authHint"),
    authUsername: document.querySelector("#authUsername"),
    authPassword: document.querySelector("#authPassword"),
    authSubmit: document.querySelector("#authSubmit"),
    authModeToggle: document.querySelector("#authModeToggle"),
    authMessage: document.querySelector("#authMessage"),
    logoutButton: document.querySelector("#logoutButton"),
    backupMenu: document.querySelector("#backupMenu"),
    toggleBackupMenu: document.querySelector("#toggleBackupMenu"),
    exportBackup: document.querySelector("#exportBackup"),
    overwriteImportBackup: document.querySelector("#overwriteImportBackup"),
    mergeImportBackup: document.querySelector("#mergeImportBackup"),
    backupFileInput: document.querySelector("#backupFileInput"),
    avatarButton: document.querySelector("#avatarButton"),
    avatarFileInput: document.querySelector("#avatarFileInput"),
    profileAvatar: document.querySelector("#profileAvatar"),
    toggleOwnerIds: document.querySelector("#toggleOwnerIds")
  };

  const questionStore = window.WQStorage.createQuestionStore({
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    storeName: STORE_NAME,
    bucketName: "question-images",
    questionsTableName: "questions",
    settingsTableName: "user_settings"
  });
  const authStore = window.WQStorage.createAuthStore();
  const { readJson, writeJson } = window.WQStorage;
  const { closeDialog, folderKey, openDialog, renderMedia, renderPreview, scopeKey, typeFolderKey, unique } = window.WQUtils;
  const authConfig = authStore.config;
  const clearQuestionDb = questionStore.clear;
  const deleteQuestionFromDb = questionStore.remove;
  const getAllFromDb = questionStore.getAll;
  const isAuthenticated = authStore.isAuthenticated;
  const openDb = questionStore.open;
  const putQuestion = questionStore.put;
  const noteSaveTimers = new Map();
  let sourceProfile = null;
  let authMode = "login";
  let hasBound = false;
  const sortableFilters = {};

  function showAuthScreen() {
    els.authTitle.textContent = authMode === "register" ? "注册错题本" : "登录错题本";
    els.authHint.textContent = authMode === "register" ? "注册后会创建你的云端私人题库" : "使用邮箱和密码登录你的云端题库";
    els.authSubmit.textContent = authMode === "register" ? "注册" : "登录";
    els.authModeToggle.textContent = authMode === "register" ? "已有账号，去登录" : "注册新账号";
    els.authMessage.textContent = "";
    els.authMessage.classList.remove("is-error");
    els.authPassword.value = "";
    els.authScreen.classList.add("is-visible");
    setTimeout(() => els.authUsername.focus(), 0);
  }

  function hideAuthScreen() {
    els.authScreen.classList.remove("is-visible");
  }

  function setAuthMessage(message, isError) {
    els.authMessage.textContent = message;
    els.authMessage.classList.toggle("is-error", Boolean(isError));
  }

  function createSourceId() {
    if (crypto.randomUUID) return `source-${crypto.randomUUID()}`;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `source-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  function sourceNameFallback() {
    return (authConfig() && authConfig().username) || "当前账号";
  }

  function loadSourceProfile(displayName) {
    const config = authConfig();
    const accountProfile = config && config.userId ? { sourceId: `user-${config.userId}`, sourceName: displayName || config.username || "当前账号" } : null;
    const stored = readJson(SOURCE_KEY, null);
    sourceProfile = accountProfile || (stored && stored.sourceId ? stored : { sourceId: createSourceId(), sourceName: displayName || sourceNameFallback() });
    writeJson(SOURCE_KEY, sourceProfile);
    return sourceProfile;
  }

  function currentSourceProfile() {
    return sourceProfile || loadSourceProfile();
  }

  function loadAvatar() {
    state.avatar = normalizeAvatarValue(readJson(AVATAR_KEY, ""));
    renderAvatar();
  }

  function saveAvatar(value) {
    state.avatar = normalizeAvatarValue(value);
    writeJson(AVATAR_KEY, state.avatar);
    renderAvatar();
  }

  function normalizeAvatarValue(value) {
    const avatar = String(value || "");
    return avatar.includes("profile-avatar.jpg") ? "" : avatar;
  }

  function renderAvatar() {
    const hasAvatar = Boolean(state.avatar);
    els.avatarButton.classList.toggle("has-avatar", hasAvatar);
    els.avatarButton.setAttribute("aria-label", "更换个人头像");
    els.avatarButton.title = "更换个人头像";
    els.profileAvatar.hidden = false;
    els.profileAvatar.src = state.avatar || DEFAULT_AVATAR_SRC;
  }

  function isAllowedAvatarFile(file) {
    if (!file) return false;
    const name = String(file.name || "").toLowerCase();
    return ["image/jpeg", "image/png"].includes(file.type) || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png");
  }

  function selectAvatarFile(file) {
    if (!isAllowedAvatarFile(file)) {
      window.alert("请选择 .jpg 或 .png 格式的头像文件。");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      window.alert("头像文件不能超过 2MB。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => saveAvatar(String(reader.result || ""));
    reader.onerror = () => window.alert("头像读取失败，请重新选择文件。");
    reader.readAsDataURL(file);
  }

  function sourceLabel(question) {
    return question.sourceName || question.ownerName || question.sourceId || "未知";
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
    if (!CATEGORIES.includes(cleanCategory) || !cleanSubject || isReservedFolderValue(cleanSubject) || subjectFolderExists(cleanCategory, cleanSubject)) return false;
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
    if (!CATEGORIES.includes(cleanCategory) || !cleanSubject || !cleanType || isReservedFolderValue(cleanSubject) || isReservedFolderValue(cleanType) || typeFolderExists(cleanCategory, cleanSubject, cleanType)) return false;
    state.customTypeFolders.push({ category: cleanCategory, subject: cleanSubject, type: cleanType });
    return true;
  }

  function typeFolderExists(category, subject, type) {
    return [...defaultTypeFolders, ...state.customTypeFolders].some((folder) => folder.category === category && folder.subject === subject && folder.type === type);
  }

  function loadFolders() {
    const stored = readJson(FOLDER_KEY, {});
    CATEGORIES = Array.isArray(stored.categories) && stored.categories.length ? unique(stored.categories) : [...DEFAULT_CATEGORIES];
    if (Array.isArray(stored.defaultSubjectFolders)) {
      defaultSubjectFolders.splice(0, defaultSubjectFolders.length, ...stored.defaultSubjectFolders);
    }
    if (Array.isArray(stored.defaultTypeFolders)) {
      defaultTypeFolders.splice(0, defaultTypeFolders.length, ...stored.defaultTypeFolders);
    }
    state.customSubjectFolders = Array.isArray(stored.customSubjectFolders) ? stored.customSubjectFolders : [];
    state.customTypeFolders = Array.isArray(stored.customTypeFolders) ? stored.customTypeFolders : [];
    state.hiddenSubjects = Array.isArray(stored.hiddenSubjects) ? stored.hiddenSubjects : [];
    state.hiddenTypes = Array.isArray(stored.hiddenTypes) ? stored.hiddenTypes : [];
    state.deletedQuestionIds = Array.isArray(stored.deletedQuestionIds) ? stored.deletedQuestionIds : [];
    state.pinnedQuestions = Array.isArray(stored.pinnedQuestions) ? stored.pinnedQuestions : [];
    state.subjectOrders = stored.subjectOrders && typeof stored.subjectOrders === "object" ? stored.subjectOrders : {};
    state.typeOrders = stored.typeOrders && typeof stored.typeOrders === "object" ? stored.typeOrders : {};

    if (state.customSubjectFolders.length === 0 && state.customTypeFolders.length === 0) {
      migrateLegacyFolders();
    }
  }

  function migrateLegacyFolders() {
    LEGACY_FOLDER_KEYS.forEach((key) => {
      try {
        const legacy = readJson(key, {});
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
    writeJson(FOLDER_KEY, {
      categories: CATEGORIES,
      defaultSubjectFolders,
      defaultTypeFolders,
      customSubjectFolders: state.customSubjectFolders,
      customTypeFolders: state.customTypeFolders,
      hiddenSubjects: state.hiddenSubjects,
      hiddenTypes: state.hiddenTypes,
      deletedQuestionIds: state.deletedQuestionIds,
      pinnedQuestions: state.pinnedQuestions,
      subjectOrders: state.subjectOrders,
      typeOrders: state.typeOrders
    });
  }

  function normalizeQuestion(item) {
    const category = item.category || inferCategory(item.subject);
    const profile = currentSourceProfile();
    return {
      ...item,
      category,
      note: item.note || "",
      questionImages: Array.isArray(item.questionImages) ? item.questionImages : item.questionImages ? [item.questionImages] : [],
      answerImages: Array.isArray(item.answerImages) ? item.answerImages : item.answerImages ? [item.answerImages] : [],
      sourceId: item.sourceId || item.ownerId || profile.sourceId,
      sourceName: item.sourceName || item.ownerName || profile.sourceName
    };
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

  function orderedValues(values, order) {
    const cleanValues = unique(values);
    const cleanOrder = unique(order || []);
    return [...cleanOrder.filter((value) => cleanValues.includes(value)), ...cleanValues.filter((value) => !cleanOrder.includes(value))];
  }

  function visibleSubjects() {
    const subjects = unique(visibleSubjectFolders().map((folder) => folder.subject));
    return orderedValues(subjects, state.subjectOrders[state.category]);
  }

  function visibleTypeFolders() {
    const folders = allTypeFolders();
    return folders.filter((folder) => {
      return (state.category === "all" || folder.category === state.category) && (state.subject === "all" || folder.subject === state.subject);
    });
  }

  function visibleTypes() {
    const types = unique(visibleTypeFolders().map((folder) => folder.type));
    return orderedValues(types, state.typeOrders[folderKey(state.category, state.subject)]);
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

  function closeSortableFilters(exceptKey) {
    Object.entries(sortableFilters).forEach(([key, filter]) => {
      if (key !== exceptKey) {
        filter.wrapper.classList.remove("is-open");
        filter.button.setAttribute("aria-expanded", "false");
      }
    });
  }

  function optionRows(select) {
    return [...select.options].map((option) => ({
      label: option.textContent,
      value: option.value,
      disabled: option.disabled
    }));
  }

  function reorderOptionValues(key, values) {
    if (key === "category") {
      CATEGORIES = orderedValues(values, values);
      if (state.category !== "all" && !CATEGORIES.includes(state.category)) state.category = "all";
      saveFolders();
      render();
      return;
    }
    if (key === "subject") {
      if (state.category === "all") return;
      state.subjectOrders[state.category] = orderedValues(values, values);
      saveFolders();
      render();
      return;
    }
    if (key === "type") {
      if (state.category === "all" || state.subject === "all") return;
      state.typeOrders[folderKey(state.category, state.subject)] = orderedValues(values, values);
      saveFolders();
      render();
    }
  }

  function createSortableFilter(select, key) {
    const wrapper = document.createElement("div");
    wrapper.className = "sortable-filter";

    const button = document.createElement("button");
    button.className = "sortable-filter-button";
    button.type = "button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.className = "sortable-filter-menu";
    menu.setAttribute("role", "listbox");

    wrapper.append(button, menu);
    select.after(wrapper);
    select.classList.add("native-filter");

    button.addEventListener("click", () => {
      if (select.disabled) return;
      const nextOpen = !wrapper.classList.contains("is-open");
      closeSortableFilters(key);
      wrapper.classList.toggle("is-open", nextOpen);
      button.setAttribute("aria-expanded", String(nextOpen));
    });

    sortableFilters[key] = { button, menu, select, wrapper };
  }

  function syncSortableFilter(key) {
    const filter = sortableFilters[key];
    if (!filter) return;
    const { button, menu, select, wrapper } = filter;
    const selected = select.options[select.selectedIndex];
    button.textContent = selected ? selected.textContent : "";
    button.disabled = select.disabled;
    wrapper.classList.toggle("is-disabled", select.disabled);
    menu.innerHTML = "";

    let draggedValue = "";
    const rows = optionRows(select);
    rows.forEach((row) => {
      const item = document.createElement("button");
      item.className = "sortable-filter-option";
      item.type = "button";
      item.setAttribute("role", "option");
      item.dataset.value = row.value;
      item.textContent = row.label;
      item.draggable = row.value !== "all" && !row.disabled;
      item.classList.toggle("is-fixed", row.value === "all");
      item.classList.toggle("is-selected", row.value === select.value);
      item.setAttribute("aria-selected", String(row.value === select.value));

      item.addEventListener("click", () => {
        select.value = row.value;
        closeSortableFilters();
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      item.addEventListener("dragstart", (event) => {
        if (!item.draggable) return;
        draggedValue = row.value;
        item.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.value);
      });
      item.addEventListener("dragend", () => {
        draggedValue = "";
        item.classList.remove("is-dragging");
      });
      item.addEventListener("dragover", (event) => {
        if (!draggedValue || row.value === "all") return;
        event.preventDefault();
      });
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        const fromValue = event.dataTransfer.getData("text/plain") || draggedValue;
        const toValue = row.value;
        if (!fromValue || !toValue || fromValue === toValue || toValue === "all") return;
        const movable = optionRows(select)
          .map((option) => option.value)
          .filter((value) => value !== "all");
        const fromIndex = movable.indexOf(fromValue);
        const toIndex = movable.indexOf(toValue);
        if (fromIndex < 0 || toIndex < 0) return;
        const [moved] = movable.splice(fromIndex, 1);
        movable.splice(toIndex, 0, moved);
        reorderOptionValues(key, movable);
      });

      menu.append(item);
    });
  }

  function syncSortableFilters() {
    ["category", "subject", "type"].forEach(syncSortableFilter);
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

  function renderModuleList(container, folders, labeler, removeHandler, renameHandler) {
    container.innerHTML = "";
    folders.forEach((folder) => {
      const chip = document.createElement("span");
      chip.className = "module-chip";
      chip.append(document.createTextNode(labeler(folder)));
      if (renameHandler) {
        const renameButton = document.createElement("button");
        renameButton.className = "rename-chip";
        renameButton.type = "button";
        renameButton.setAttribute("aria-label", `重命名 ${labeler(folder)}`);
        renameButton.textContent = "改";
        renameButton.addEventListener("click", () => renameHandler(folder));
        chip.append(renameButton);
      }
      if (removeHandler) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `删除 ${labeler(folder)}`);
        button.textContent = "×";
        button.addEventListener("click", () => removeHandler(folder));
        chip.append(button);
      }
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

  function questionOrdinal(item) {
    const folderItems = allQuestions().filter((question) => {
      return question.category === item.category && question.subject === item.subject && question.type === item.type;
    });
    const index = folderItems.findIndex((question) => question.id === item.id);
    return index >= 0 ? index + 1 : 1;
  }

  function questionTitle(item) {
    return `第 ${questionOrdinal(item)} 题`;
  }

  function createQuestionId(createdAt) {
    const profile = currentSourceProfile();
    const shortSource = profile.sourceId.replace(/^source-/, "").slice(0, 12);
    const random = Math.random().toString(36).slice(2, 8);
    return `q-${shortSource}-${createdAt}-${random}`;
  }

  function renderQuestion(item, index) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.classList.toggle("is-pinned-copy", Boolean(item.isPinnedCopy));
    node.querySelector("h3").textContent = questionTitle(item);

    const meta = node.querySelector(".meta-row");
    if (state.showOwnerIds) {
      const ownerPill = document.createElement("span");
      ownerPill.className = "meta owner-meta";
      ownerPill.textContent = `创建者：${sourceLabel(item)}`;
      meta.append(ownerPill);
    }
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
      deleteButton.addEventListener("click", () => deleteQuestion(item.id, questionTitle(item)));
      actions.append(deleteButton);

      const moveButton = document.createElement("button");
      moveButton.className = "move-question";
      moveButton.type = "button";
      moveButton.textContent = "迁移";
      moveButton.addEventListener("click", () => moveQuestion(item.id));
      actions.append(moveButton);
    }

    renderMedia(node.querySelector(".question-media"), (item.questionImages || []).slice(0, 1), `${questionTitle(item)} 题目截图`);

    const fullQuestionContent = node.querySelector(".full-question-content");
    if ((item.questionImages || []).length > 1) {
      renderMedia(node.querySelector(".full-question-media"), item.questionImages, `${questionTitle(item)} 完整题目截图`);
    } else {
      fullQuestionContent.remove();
    }

    const answerMedia = node.querySelector(".answer-media");
    renderMedia(answerMedia, item.answerImages, `${questionTitle(item)} 答案解析截图`);

    const answerPanel = node.querySelector(".answer-panel");
    const summaryHint = node.querySelector(".summary-hint");
    const syncSummaryHint = () => {
      summaryHint.textContent = answerPanel.open ? "点击收起" : "点击展开";
    };
    answerPanel.addEventListener("toggle", syncSummaryHint);
    syncSummaryHint();

    const noteInput = node.querySelector(".question-note");
    const noteStatus = node.querySelector(".note-save-status");
    const finishNoteButton = node.querySelector(".finish-note-button");
    noteInput.value = item.note || "";
    setNoteStatus(noteStatus, "已保存", "saved");
    noteInput.addEventListener("input", () => scheduleQuestionNoteSave(item.id, noteInput.value, noteStatus));
    noteInput.addEventListener("blur", () => {
      clearTimeout(noteSaveTimers.get(item.id));
      noteSaveTimers.delete(item.id);
      saveQuestionNoteWithStatus(item.id, noteInput.value, noteStatus, "已保存");
    });
    finishNoteButton.addEventListener("mousedown", (event) => event.preventDefault());
    finishNoteButton.addEventListener("click", () => {
      clearTimeout(noteSaveTimers.get(item.id));
      noteSaveTimers.delete(item.id);
      saveQuestionNoteWithStatus(item.id, noteInput.value, noteStatus, "已完成");
    });

    return node;
  }

  function renderTypeDivider(type) {
    const divider = document.createElement("div");
    divider.className = "type-divider";
    divider.textContent = type || "未分类";
    return divider;
  }

  function renderPastePreviews() {
    renderPastePreviewList(els.questionPreview, state.paste.questionImages, "questionImages", els.questionPasteBox, els.questionImageInput);
    renderPastePreviewList(els.answerPreview, state.paste.answerImages, "answerImages", els.answerPasteBox, els.answerImageInput);
  }

  function renderPastePreviewList(container, images, targetKey, pasteBox, fileInput) {
    container.innerHTML = "";

    const list = document.createElement("div");
    list.className = "paste-preview-list";
    if (images.length === 0) {
      const empty = document.createElement("div");
      empty.className = "paste-preview-empty";
      empty.textContent = "等待图片";
      list.append(empty);
    }
    images.forEach((imageData, index) => {
      const item = document.createElement("div");
      item.className = "paste-preview-item";
      item.append(renderPreviewImage(imageData, `已粘贴截图 ${index + 1}`));

      const removeButton = document.createElement("button");
      removeButton.className = "remove-paste-image";
      removeButton.type = "button";
      removeButton.setAttribute("aria-label", `删除第 ${index + 1} 张截图`);
      removeButton.textContent = "×";
      removeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        state.paste[targetKey].splice(index, 1);
        renderPastePreviews();
      });
      item.append(removeButton);
      list.append(item);
    });

    const addButton = document.createElement("button");
    addButton.className = "paste-add-strip";
    addButton.type = "button";
    addButton.setAttribute("aria-label", "添加图片");
    addButton.title = "拍照或从相册选择";
    addButton.textContent = "+";
    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (fileInput) fileInput.click();
      else pasteBox.focus();
    });
    list.append(addButton);
    container.append(list);
  }

  function renderPreviewImage(imageData, label) {
    const image = document.createElement("img");
    image.className = "shot";
    image.src = imageData;
    image.alt = label;
    return image;
  }

  function resetPaste() {
    state.paste.questionImages = [];
    state.paste.answerImages = [];
    state.paste.note = "";
    els.pasteNote.value = "";
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
    syncSortableFilters();
    renderSubjectOptions();
    renderTabs();
    renderStats(items, subjectFolders.length, types.length);
    els.toggleOwnerIds.textContent = state.showOwnerIds ? "隐藏ID" : "显示ID";
    renderModuleList(els.categoryList, CATEGORIES, (category) => category, null, renameCategory);
    renderModuleList(els.subjectList, allSubjectFolders(), (folder) => `${folder.category} / ${folder.subject}`, deleteSubject, renameSubject);
    renderModuleList(els.typeList, allTypeFolders(), (folder) => `${folder.category} / ${folder.subject} / ${folder.type}`, deleteType, renameType);

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
      state.paste[targetKey].push(reader.result);
      renderPastePreviews();
    };
    reader.readAsDataURL(file);
  }

  function addImageFiles(files, targetKey) {
    const selectedFiles = [...(files || [])];
    if (selectedFiles.length === 0) return;

    const imageFiles = selectedFiles.filter((file) => file && file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      window.alert("请选择图片文件。");
      return;
    }

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        state.paste[targetKey].push(reader.result);
        renderPastePreviews();
      };
      reader.readAsDataURL(file);
    });
  }

  function handleImageInputChange(event, targetKey) {
    addImageFiles(event.target.files, targetKey);
    event.target.value = "";
  }

  async function savePastedQuestion() {
    if (state.paste.questionImages.length === 0 || state.paste.answerImages.length === 0) {
      window.alert("请先分别粘贴题目截图和解析截图。");
      return;
    }

    const folderQuestions = allQuestions().filter((item) => item.category === state.category && item.subject === state.subject && item.type === state.type);
    const createdAt = Date.now();
    const profile = currentSourceProfile();
    const question = {
      id: createQuestionId(createdAt),
      category: state.category,
      subject: state.subject,
      type: state.type,
      title: `第 ${folderQuestions.length + 1} 题`,
      createdAt,
      sourceId: profile.sourceId,
      sourceName: profile.sourceName,
      questionImages: [...state.paste.questionImages],
      answerImages: [...state.paste.answerImages],
      note: state.paste.note.trim()
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

  function setNoteStatus(statusEl, text, stateName) {
    statusEl.textContent = text;
    statusEl.dataset.state = stateName;
  }

  function scheduleQuestionNoteSave(id, note, statusEl) {
    clearTimeout(noteSaveTimers.get(id));
    setNoteStatus(statusEl, "编辑中", "editing");
    noteSaveTimers.set(
      id,
      setTimeout(() => {
        noteSaveTimers.delete(id);
        saveQuestionNoteWithStatus(id, note, statusEl, "已保存");
      }, 600)
    );
  }

  async function saveQuestionNoteWithStatus(id, note, statusEl, doneText) {
    setNoteStatus(statusEl, "保存中", "saving");
    try {
      await saveQuestionNote(id, note);
      setNoteStatus(statusEl, doneText, doneText === "已完成" ? "done" : "saved");
    } catch (error) {
      setNoteStatus(statusEl, "保存失败", "error");
      window.alert("备注保存失败，请稍后重试。");
    }
  }

  async function saveQuestionNote(id, note) {
    const cleanNote = String(note || "").trim();
    const existing = state.customQuestions.find((item) => item.id === id);
    if (!existing || (existing.note || "") === cleanNote) return;

    const updated = { ...normalizeQuestion(existing), note: cleanNote };
    await putQuestion(updated);
    state.customQuestions = state.customQuestions.map((item) => (item.id === id ? updated : item));
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

  function cleanPromptValue(value) {
    return String(value || "").trim();
  }

  function isReservedFolderValue(value) {
    return cleanPromptValue(value).toLowerCase() === "all";
  }

  function remapPrefixedValue(value, oldPrefix, newPrefix) {
    const text = String(value);
    return text === oldPrefix || text.startsWith(`${oldPrefix}|||`) ? `${newPrefix}${text.slice(oldPrefix.length)}` : text;
  }

  function remapList(values, mapper) {
    return unique((values || []).map((value) => mapper(value)));
  }

  function updateFolderCategory(oldCategory, newCategory) {
    defaultSubjectFolders.forEach((folder) => {
      if (folder.category === oldCategory) folder.category = newCategory;
    });
    defaultTypeFolders.forEach((folder) => {
      if (folder.category === oldCategory) folder.category = newCategory;
    });
    state.customSubjectFolders = state.customSubjectFolders.map((folder) => (folder.category === oldCategory ? { ...folder, category: newCategory } : folder));
    state.customTypeFolders = state.customTypeFolders.map((folder) => (folder.category === oldCategory ? { ...folder, category: newCategory } : folder));
  }

  function updateFolderSubject(category, oldSubject, newSubject) {
    defaultSubjectFolders.forEach((folder) => {
      if (folder.category === category && folder.subject === oldSubject) folder.subject = newSubject;
    });
    defaultTypeFolders.forEach((folder) => {
      if (folder.category === category && folder.subject === oldSubject) folder.subject = newSubject;
    });
    state.customSubjectFolders = state.customSubjectFolders.map((folder) =>
      folder.category === category && folder.subject === oldSubject ? { ...folder, subject: newSubject } : folder
    );
    state.customTypeFolders = state.customTypeFolders.map((folder) =>
      folder.category === category && folder.subject === oldSubject ? { ...folder, subject: newSubject } : folder
    );
  }

  function updateFolderType(category, subject, oldType, newType) {
    defaultTypeFolders.forEach((folder) => {
      if (folder.category === category && folder.subject === subject && folder.type === oldType) folder.type = newType;
    });
    state.customTypeFolders = state.customTypeFolders.map((folder) =>
      folder.category === category && folder.subject === subject && folder.type === oldType ? { ...folder, type: newType } : folder
    );
  }

  async function renameCategory(category) {
    const nextCategory = cleanPromptValue(window.prompt(`将科目大类“${category}”重命名为：`, category));
    if (!nextCategory || nextCategory === category) return;
    if (isReservedFolderValue(nextCategory)) {
      window.alert("不能使用 all 作为目录名称。");
      return;
    }
    if (CATEGORIES.includes(nextCategory)) {
      window.alert("已存在同名科目大类。");
      return;
    }

    CATEGORIES = CATEGORIES.map((value) => (value === category ? nextCategory : value));
    updateFolderCategory(category, nextCategory);
    state.hiddenSubjects = remapList(state.hiddenSubjects, (value) => remapPrefixedValue(value, category, nextCategory));
    state.hiddenTypes = remapList(state.hiddenTypes, (value) => remapPrefixedValue(value, category, nextCategory));
    state.pinnedQuestions = state.pinnedQuestions.map((pin) => ({ ...pin, scope: remapPrefixedValue(pin.scope, category, nextCategory) }));
    if (state.category === category) state.category = nextCategory;

    await updateQuestions((item) => (item.category === category ? { ...item, category: nextCategory } : item));
    saveFolders();
    render();
  }

  async function renameSubject(folder) {
    const nextSubject = cleanPromptValue(window.prompt(`将学科“${folder.category} / ${folder.subject}”重命名为：`, folder.subject));
    if (!nextSubject || nextSubject === folder.subject) return;
    if (isReservedFolderValue(nextSubject)) {
      window.alert("不能使用 all 作为目录名称。");
      return;
    }
    if (allSubjectFolders().some((item) => item.category === folder.category && item.subject === nextSubject)) {
      window.alert("当前科目大类下已存在同名学科。");
      return;
    }

    const oldPrefix = folderKey(folder.category, folder.subject);
    const newPrefix = folderKey(folder.category, nextSubject);
    updateFolderSubject(folder.category, folder.subject, nextSubject);
    state.hiddenSubjects = remapList(state.hiddenSubjects, (value) => (value === folder.subject ? nextSubject : remapPrefixedValue(value, oldPrefix, newPrefix)));
    state.hiddenTypes = remapList(state.hiddenTypes, (value) => remapPrefixedValue(value, oldPrefix, newPrefix));
    state.pinnedQuestions = state.pinnedQuestions.map((pin) => ({ ...pin, scope: remapPrefixedValue(pin.scope, oldPrefix, newPrefix) }));
    if (state.category === folder.category && state.subject === folder.subject) state.subject = nextSubject;

    await updateQuestions((item) => (item.category === folder.category && item.subject === folder.subject ? { ...item, subject: nextSubject } : item));
    saveFolders();
    render();
  }

  async function renameType(folder) {
    const nextType = cleanPromptValue(window.prompt(`将目录“${folder.category} / ${folder.subject} / ${folder.type}”重命名为：`, folder.type));
    if (!nextType || nextType === folder.type) return;
    if (isReservedFolderValue(nextType)) {
      window.alert("不能使用 all 作为目录名称。");
      return;
    }
    if (allTypeFolders().some((item) => item.category === folder.category && item.subject === folder.subject && item.type === nextType)) {
      window.alert("当前学科下已存在同名目录。");
      return;
    }

    const oldKey = typeFolderKey(folder.category, folder.subject, folder.type);
    const newKey = typeFolderKey(folder.category, folder.subject, nextType);
    updateFolderType(folder.category, folder.subject, folder.type, nextType);
    state.hiddenTypes = remapList(state.hiddenTypes, (value) => (value === folder.type ? nextType : value === oldKey ? newKey : value));
    state.pinnedQuestions = state.pinnedQuestions.map((pin) => ({ ...pin, scope: pin.scope === oldKey ? newKey : pin.scope }));
    if (state.category === folder.category && state.subject === folder.subject && state.type === folder.type) state.type = nextType;

    await updateQuestions((item) => (item.category === folder.category && item.subject === folder.subject && item.type === folder.type ? { ...item, type: nextType } : item));
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

  async function resequenceFolder(category, subject, type) {
    const folderItems = state.customQuestions
      .map(normalizeQuestion)
      .filter((item) => {
        return item.category === category && item.subject === subject && item.type === type && !state.deletedQuestionIds.includes(item.id);
      })
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const titleById = new Map(folderItems.map((item, index) => [item.id, `第 ${index + 1} 题`]));
    state.customQuestions = state.customQuestions.map((item) => {
      const nextTitle = titleById.get(item.id);
      return nextTitle ? { ...normalizeQuestion(item), title: nextTitle } : item;
    });

    await Promise.all(state.customQuestions.filter((item) => titleById.has(item.id)).map((item) => putQuestion(item)));
  }

  async function resequenceAllFolders() {
    const folderKeys = unique(
      state.customQuestions.map((item) => {
        const normalized = normalizeQuestion(item);
        return typeFolderKey(normalized.category, normalized.subject, normalized.type);
      })
    );

    for (const key of folderKeys) {
      const [category, subject, type] = key.split("|||");
      await resequenceFolder(category, subject, type);
    }
  }

  async function deleteQuestion(id, title) {
    if (!window.confirm(`确定删除错题“${title}”吗？删除后不会在页面中显示。`)) return;

    const deleting = normalizeQuestion(state.customQuestions.find((item) => item.id === id) || questionById(id) || {});
    state.customQuestions = state.customQuestions.filter((item) => item.id !== id);
    state.deletedQuestionIds.push(id);
    state.pinnedQuestions = state.pinnedQuestions.filter((pin) => pin.questionId !== id);
    await deleteQuestionFromDb(id);
    if (deleting.category && deleting.subject && deleting.type) {
      await resequenceFolder(deleting.category, deleting.subject, deleting.type);
    }
    saveFolders();
    render();
  }

  function promptFolderValue(label, currentValue, options) {
    const optionText = options.length ? `\n可选：${options.join("、")}` : "";
    return cleanPromptValue(window.prompt(`${label}${optionText}`, currentValue));
  }

  function remapQuestionPinsForMove(questionId, from, to) {
    const oldSubjectScope = scopeKey(from.category, from.subject, "all");
    const newSubjectScope = scopeKey(to.category, to.subject, "all");
    const oldTypeScope = typeFolderKey(from.category, from.subject, from.type);
    const newTypeScope = typeFolderKey(to.category, to.subject, to.type);
    state.pinnedQuestions = state.pinnedQuestions.map((pin) => {
      if (pin.questionId !== questionId) return pin;
      if (pin.scope === oldSubjectScope) return { ...pin, scope: newSubjectScope };
      if (pin.scope === oldTypeScope) return { ...pin, scope: newTypeScope };
      return pin;
    });
  }

  async function moveQuestion(id) {
    const existing = state.customQuestions.find((item) => item.id === id);
    if (!existing) {
      window.alert("这道题不是当前浏览器新增或导入的题，暂时不能迁移。");
      return;
    }

    const question = normalizeQuestion(existing);
    const targetCategory = promptFolderValue("目标科目大类：", question.category, CATEGORIES);
    if (!targetCategory) return;
    if (isReservedFolderValue(targetCategory)) {
      window.alert("不能使用 all 作为目录名称。");
      return;
    }
    if (!CATEGORIES.includes(targetCategory)) {
      window.alert("目标科目大类不存在，请先在管理弹窗中重命名或维护大类。");
      return;
    }

    const subjectOptions = unique(allSubjectFolders().filter((folder) => folder.category === targetCategory).map((folder) => folder.subject));
    const targetSubject = promptFolderValue("目标学科：", question.subject, subjectOptions);
    if (!targetSubject) return;
    if (isReservedFolderValue(targetSubject)) {
      window.alert("不能使用 all 作为目录名称。");
      return;
    }
    if (!subjectFolderExists(targetCategory, targetSubject)) {
      const shouldCreateSubject = window.confirm(`“${targetCategory} / ${targetSubject}”学科不存在，是否新建后迁移？`);
      if (!shouldCreateSubject) return;
      addSubjectFolder(targetCategory, targetSubject);
    }

    const typeOptions = unique(
      allTypeFolders()
        .filter((folder) => folder.category === targetCategory && folder.subject === targetSubject)
        .map((folder) => folder.type)
    );
    const targetType = promptFolderValue("目标题型 / 目录：", question.type, typeOptions);
    if (!targetType) return;
    if (isReservedFolderValue(targetType)) {
      window.alert("不能使用 all 作为目录名称。");
      return;
    }
    if (!typeFolderExists(targetCategory, targetSubject, targetType)) {
      const shouldCreateType = window.confirm(`“${targetCategory} / ${targetSubject} / ${targetType}”目录不存在，是否新建后迁移？`);
      if (!shouldCreateType) return;
      addTypeFolder(targetCategory, targetSubject, targetType);
    }

    if (question.category === targetCategory && question.subject === targetSubject && question.type === targetType) return;

    const moved = {
      ...question,
      category: targetCategory,
      subject: targetSubject,
      type: targetType
    };
    state.customQuestions = state.customQuestions.map((item) => (item.id === id ? moved : item));
    remapQuestionPinsForMove(id, question, moved);
    await putQuestion(moved);
    await resequenceFolder(question.category, question.subject, question.type);
    await resequenceFolder(targetCategory, targetSubject, targetType);
    state.category = targetCategory;
    state.subject = targetSubject;
    state.type = targetType;
    const folderQuestions = allQuestions().filter((item) => item.category === targetCategory && item.subject === targetSubject && item.type === targetType);
    const targetIndex = folderQuestions.findIndex((item) => item.id === id);
    state.page = Math.max(1, Math.ceil((targetIndex + 1) / PAGE_SIZE));
    saveFolders();
    render();
  }

  function folderBackup() {
    return {
      categories: CATEGORIES,
      defaultSubjectFolders,
      defaultTypeFolders,
      customSubjectFolders: state.customSubjectFolders,
      customTypeFolders: state.customTypeFolders,
      hiddenSubjects: state.hiddenSubjects,
      hiddenTypes: state.hiddenTypes,
      deletedQuestionIds: state.deletedQuestionIds,
      pinnedQuestions: state.pinnedQuestions,
      subjectOrders: state.subjectOrders,
      typeOrders: state.typeOrders
    };
  }

  function backupFileName(questionCount, prefix = "错题本备份") {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      `${pad(date.getHours())}${pad(date.getMinutes())}`
    ].join("-");
    return `${prefix}-${stamp}-共${questionCount}题.json`;
  }

  function backupPayload() {
    const questions = allQuestions().map((item) => normalizeQuestion(item));
    return {
      app: "kaoyan-wrong-questions",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      questionCount: questions.length,
      categories: CATEGORIES,
      sourceProfile: currentSourceProfile(),
      folders: folderBackup(),
      questions
    };
  }

  function downloadBackup(backup, prefix) {
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName(backup.questions.length, prefix);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportBackup() {
    downloadBackup(backupPayload(), "错题本备份");
  }

  function readBackupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function arrayFromBackup(value) {
    return Array.isArray(value) ? value : [];
  }

  function applyFolderBackup(backup) {
    const backupFolders = backup.folders || {};
    const backupCategories = arrayFromBackup(backupFolders.categories).length ? backupFolders.categories : backup.categories;
    CATEGORIES = arrayFromBackup(backupCategories).length ? unique(backupCategories) : [...DEFAULT_CATEGORIES];
    const restoredDefaultSubjects = Array.isArray(backupFolders.defaultSubjectFolders) ? backupFolders.defaultSubjectFolders : initialDefaultSubjectFolders;
    const restoredDefaultTypes = Array.isArray(backupFolders.defaultTypeFolders) ? backupFolders.defaultTypeFolders : initialDefaultTypeFolders;
    defaultSubjectFolders.splice(0, defaultSubjectFolders.length, ...restoredDefaultSubjects.map((folder) => ({ ...folder })));
    defaultTypeFolders.splice(0, defaultTypeFolders.length, ...restoredDefaultTypes.map((folder) => ({ ...folder })));
    state.customSubjectFolders = arrayFromBackup(backupFolders.customSubjectFolders);
    state.customTypeFolders = arrayFromBackup(backupFolders.customTypeFolders);
    state.hiddenSubjects = arrayFromBackup(backupFolders.hiddenSubjects);
    state.hiddenTypes = arrayFromBackup(backupFolders.hiddenTypes);
    state.deletedQuestionIds = arrayFromBackup(backupFolders.deletedQuestionIds);
    state.pinnedQuestions = arrayFromBackup(backupFolders.pinnedQuestions);
    state.subjectOrders = backupFolders.subjectOrders && typeof backupFolders.subjectOrders === "object" ? backupFolders.subjectOrders : {};
    state.typeOrders = backupFolders.typeOrders && typeof backupFolders.typeOrders === "object" ? backupFolders.typeOrders : {};
  }

  function applySourceBackup(backup) {
    if (!backup.sourceProfile || !backup.sourceProfile.sourceId) return;
    const config = authConfig();
    if (!config) return;
    sourceProfile = {
      sourceId: `user-${config.userId}`,
      sourceName: sourceNameFallback()
    };
    writeJson(SOURCE_KEY, sourceProfile);
  }

  function normalizeBackupQuestion(item) {
    if (!item || typeof item !== "object") return null;
    const question = normalizeQuestion({
      ...item,
      questionImages: arrayFromBackup(item.questionImages),
      answerImages: arrayFromBackup(item.answerImages),
      note: item.note || ""
    });
    return question.id ? question : null;
  }

  function validateBackup(backup) {
    const questions = arrayFromBackup(backup.questions);
    if (!questions.length && !backup.folders) {
      window.alert("这个 JSON 文件不是有效的错题本备份。");
      return null;
    }
    return questions;
  }

  function mergeFoldersFromQuestions(questions) {
    questions.forEach((question) => {
      if (question.category && !CATEGORIES.includes(question.category)) CATEGORIES.push(question.category);
      if (question.category && question.subject) addSubjectFolder(question.category, question.subject);
      if (question.category && question.subject && question.type) addTypeFolder(question.category, question.subject, question.type);
    });
  }

  async function overwriteImportBackupFile(file) {
    const backup = await readBackupFile(file);
    const questions = validateBackup(backup);
    if (!questions) return;

    if (allQuestions().length > 0 && window.confirm("覆盖导入会清空当前题库。是否先导出现有题库，保存一份覆盖前 JSON？")) {
      downloadBackup(backupPayload(), "覆盖前备份");
    }
    const confirmed = window.confirm(
      `确定覆盖导入“${file.name}”吗？\n\n覆盖导入优先级最高：当前浏览器里的题库会被清空，并完全恢复为该 JSON 中的 ${questions.length} 道题。账号密码不会被导入或覆盖。`
    );
    if (!confirmed) return;

    applySourceBackup(backup);
    applyFolderBackup(backup);
    const importedQuestions = questions.map(normalizeBackupQuestion).filter(Boolean);
    const importedIds = new Set(importedQuestions.map((item) => item.id));
    state.deletedQuestionIds = state.deletedQuestionIds.filter((id) => !importedIds.has(id));

    await clearQuestionDb();
    state.customQuestions = importedQuestions;
    for (const item of state.customQuestions) {
      await putQuestion(item);
    }
    await resequenceAllFolders();

    state.category = "all";
    state.subject = "all";
    state.type = "all";
    state.page = 1;
    saveFolders();
    render();
    window.alert(`覆盖导入完成，已恢复 ${state.customQuestions.length} 道题。`);
  }

  async function mergeImportBackupFile(file) {
    const backup = await readBackupFile(file);
    const questions = validateBackup(backup);
    if (!questions) return;

    const exporter = backup.sourceProfile;
    if (!exporter || !exporter.sourceId) {
      window.alert("这个备份没有创建者标识，不能安全合并。请用新版网页重新导出，或改用覆盖导入。");
      return;
    }
    if (exporter.sourceId === currentSourceProfile().sourceId) {
      window.alert("这个备份的创建者标识与当前账号相同，不需要合并导入。");
      return;
    }

    const currentIds = new Set([...allQuestions().map((item) => item.id), ...state.deletedQuestionIds]);
    const importedQuestions = questions
      .map(normalizeBackupQuestion)
      .filter(Boolean)
      .filter((question) => question.sourceId === exporter.sourceId)
      .filter((question) => !currentIds.has(question.id));

    if (importedQuestions.length === 0) {
      window.alert(`没有需要合并的新题。备份创建者“${exporter.sourceName || exporter.sourceId}”的题可能已经导入过。`);
      return;
    }

    const confirmed = window.confirm(
      `确定合并导入“${file.name}”吗？\n\n只会导入创建者为“${exporter.sourceName || exporter.sourceId}”的 ${importedQuestions.length} 道新题；当前已有题不会被删除。`
    );
    if (!confirmed) return;

    mergeFoldersFromQuestions(importedQuestions);
    state.customQuestions = [...state.customQuestions, ...importedQuestions];
    for (const item of importedQuestions) {
      await putQuestion(item);
    }
    await resequenceAllFolders();
    state.category = "all";
    state.subject = "all";
    state.type = "all";
    state.page = 1;
    saveFolders();
    render();
    window.alert(`合并导入完成，已新增 ${importedQuestions.length} 道来自“${exporter.sourceName || exporter.sourceId}”的题。`);
  }

  function bind() {
    if (hasBound) return;
    hasBound = true;
    createSortableFilter(els.category, "category");
    createSortableFilter(els.subject, "subject");
    createSortableFilter(els.type, "type");

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".sortable-filter")) closeSortableFilters();
      if (!event.target.closest("#backupMenu")) {
        els.backupMenu.classList.remove("is-open");
        els.toggleBackupMenu.setAttribute("aria-expanded", "false");
      }
    });

    els.authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = els.authUsername.value.trim();
      const password = els.authPassword.value;
      if (!username || !password) return;

      els.authSubmit.disabled = true;
      setAuthMessage(authMode === "register" ? "正在注册..." : "正在登录...", false);
      try {
        if (authMode === "register") {
          await authStore.signUp(username, password);
        } else {
          await authStore.signIn(username, password);
        }
        await loadUserData();
        hideAuthScreen();
        setAuthMessage("", false);
      } catch (error) {
        setAuthMessage(error.message || "操作失败，请稍后重试。", true);
      } finally {
        els.authSubmit.disabled = false;
      }
    });

    els.authModeToggle.addEventListener("click", () => {
      authMode = authMode === "register" ? "login" : "register";
      showAuthScreen();
    });

    els.logoutButton.addEventListener("click", async () => {
      await authStore.lock();
      state.customQuestions = [];
      state.deletedQuestionIds = [];
      state.pinnedQuestions = [];
      state.avatar = "";
      renderAvatar();
      sourceProfile = null;
      showAuthScreen();
    });
    els.toggleOwnerIds.addEventListener("click", () => {
      state.showOwnerIds = !state.showOwnerIds;
      render();
    });
    els.toggleBackupMenu.addEventListener("click", (event) => {
      event.stopPropagation();
      const nextOpen = !els.backupMenu.classList.contains("is-open");
      els.backupMenu.classList.toggle("is-open", nextOpen);
      els.toggleBackupMenu.setAttribute("aria-expanded", String(nextOpen));
    });
    els.exportBackup.addEventListener("click", () => {
      els.backupMenu.classList.remove("is-open");
      els.toggleBackupMenu.setAttribute("aria-expanded", "false");
      exportBackup();
    });
    els.overwriteImportBackup.addEventListener("click", () => {
      els.backupMenu.classList.remove("is-open");
      els.toggleBackupMenu.setAttribute("aria-expanded", "false");
      state.importMode = "overwrite";
      els.backupFileInput.click();
    });
    els.mergeImportBackup.addEventListener("click", () => {
      els.backupMenu.classList.remove("is-open");
      els.toggleBackupMenu.setAttribute("aria-expanded", "false");
      state.importMode = "merge";
      els.backupFileInput.click();
    });
    els.backupFileInput.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      if (!file) return;
      const importTask = state.importMode === "merge" ? mergeImportBackupFile(file) : overwriteImportBackupFile(file);
      importTask
        .catch(() => window.alert("导入失败，请确认选择的是错题本导出的 JSON 文件。"))
        .finally(() => {
          els.backupFileInput.value = "";
        });
    });
    els.avatarButton.addEventListener("click", () => {
      els.avatarFileInput.click();
    });
    els.avatarFileInput.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      if (file) selectAvatarFile(file);
      els.avatarFileInput.value = "";
    });

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
    els.questionPasteBox.addEventListener("paste", (event) => readPastedImage(event, "questionImages"));
    els.answerPasteBox.addEventListener("paste", (event) => readPastedImage(event, "answerImages"));
    els.questionImageInput.addEventListener("change", (event) => handleImageInputChange(event, "questionImages"));
    els.answerImageInput.addEventListener("change", (event) => handleImageInputChange(event, "answerImages"));
    els.pasteNote.addEventListener("input", (event) => {
      state.paste.note = event.target.value;
    });
    els.clearPaste.addEventListener("click", resetPaste);
    els.savePastedQuestion.addEventListener("click", () => {
      savePastedQuestion().catch(() => window.alert("保存失败，请确认网络和 Supabase 配置正常。"));
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

  function resetUserState() {
    CATEGORIES = [...DEFAULT_CATEGORIES];
    defaultSubjectFolders.splice(0, defaultSubjectFolders.length, ...initialDefaultSubjectFolders.map((folder) => ({ ...folder })));
    defaultTypeFolders.splice(0, defaultTypeFolders.length, ...initialDefaultTypeFolders.map((folder) => ({ ...folder })));
    state.category = "all";
    state.subject = "all";
    state.type = "all";
    state.customSubjectFolders = [];
    state.customTypeFolders = [];
    state.hiddenSubjects = [];
    state.hiddenTypes = [];
    state.customQuestions = [];
    state.deletedQuestionIds = [];
    state.pinnedQuestions = [];
    state.avatar = "";
    state.subjectOrders = {};
    state.typeOrders = {};
    state.page = 1;
    resetPaste();
  }

  async function loadUserData() {
    resetUserState();
    await openDb();
    loadSourceProfile(sourceNameFallback());
    loadAvatar();
    loadFolders();
    state.customQuestions = (await getAllFromDb()).map(normalizeQuestion);
    render();
  }

  async function init() {
    bind();
    if (await isAuthenticated()) {
      await loadUserData();
      hideAuthScreen();
    } else {
      showAuthScreen();
    }
  }

  init().catch(() => {
    window.alert("错题本初始化失败，请确认网络、Supabase 配置和数据库表已创建。");
  });
})();
