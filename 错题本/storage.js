(function () {
  const DEFAULT_BUCKET = "question-images";
  const DEFAULT_QUESTIONS_TABLE = "questions";
  const DEFAULT_SETTINGS_TABLE = "user_settings";
  const SIGNED_URL_TTL = 60 * 60 * 24;
  const SETTINGS_SAVE_DELAY = 500;

  const config = window.WQ_SUPABASE_CONFIG || {};
  const supabaseUrl = normalizeSupabaseUrl(config.url || "");
  const supabaseKey = config.anonKey || "";

  if (!window.supabase || !supabaseUrl || !supabaseKey) {
    throw new Error("Supabase 配置缺失，请检查 supabase-config.js 和 Supabase SDK 是否已加载。");
  }

  const client = window.supabase.createClient(supabaseUrl, supabaseKey);
  let currentUser = null;
  let settings = {};
  let settingsLoaded = false;
  let settingsSaveTimer = 0;
  let settingsTableName = DEFAULT_SETTINGS_TABLE;

  function normalizeSupabaseUrl(value) {
    return String(value || "")
      .trim()
      .replace(/\/rest\/v1\/?$/, "")
      .replace(/\/+$/, "");
  }

  function localSettingsKey(userId) {
    return `kaoyanWrongQuestions.settings.${userId}`;
  }

  function readLocalSettings(userId) {
    if (!userId) return {};
    try {
      return JSON.parse(localStorage.getItem(localSettingsKey(userId)) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function writeLocalSettings(userId, value) {
    if (!userId) return;
    localStorage.setItem(localSettingsKey(userId), JSON.stringify(value || {}));
  }

  async function refreshUser() {
    const { data, error } = await client.auth.getUser();
    if (error) {
      currentUser = null;
      return null;
    }
    currentUser = data.user || null;
    return currentUser;
  }

  async function requireUser() {
    if (currentUser) return currentUser;
    const user = await refreshUser();
    if (!user) throw new Error("请先登录。");
    return user;
  }

  async function loadSettings() {
    const user = await requireUser();
    settings = readLocalSettings(user.id);

    const { data, error } = await client.from(settingsTableName).select("settings").eq("user_id", user.id).maybeSingle();
    if (error) throw error;

    settings = data && data.settings && typeof data.settings === "object" ? data.settings : settings;
    settingsLoaded = true;
    writeLocalSettings(user.id, settings);
    return settings;
  }

  async function saveSettingsNow() {
    if (!settingsLoaded || !currentUser) return;
    writeLocalSettings(currentUser.id, settings);
    const { error } = await client.from(settingsTableName).upsert(
      {
        user_id: currentUser.id,
        settings,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
    if (error) console.error("保存用户设置失败", error);
  }

  function scheduleSettingsSave() {
    window.clearTimeout(settingsSaveTimer);
    settingsSaveTimer = window.setTimeout(saveSettingsNow, SETTINGS_SAVE_DELAY);
  }

  function readJson(key, fallback) {
    if (settingsLoaded && Object.prototype.hasOwnProperty.call(settings, key)) {
      return settings[key];
    }
    if (currentUser) {
      const cached = readLocalSettings(currentUser.id);
      if (Object.prototype.hasOwnProperty.call(cached, key)) return cached[key];
    }
    return fallback;
  }

  function writeJson(key, value) {
    settings = { ...settings, [key]: value };
    if (currentUser) writeLocalSettings(currentUser.id, settings);
    if (settingsLoaded) scheduleSettingsSave();
  }

  function createAuthStore() {
    function config() {
      return currentUser
        ? {
            username: currentUser.email || currentUser.id,
            userId: currentUser.id
          }
        : null;
    }

    async function isAuthenticated() {
      return Boolean(await refreshUser());
    }

    async function signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = data.user;
      settingsLoaded = false;
      return currentUser;
    }

    async function signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        currentUser = null;
        settingsLoaded = false;
        throw new Error("注册成功。请先到邮箱完成验证，再回来登录。");
      }
      currentUser = data.user;
      settingsLoaded = false;
      return currentUser;
    }

    async function lock() {
      await saveSettingsNow();
      await client.auth.signOut();
      currentUser = null;
      settings = {};
      settingsLoaded = false;
    }

    return {
      client,
      config,
      currentUser: () => currentUser,
      isAuthenticated,
      lock,
      signIn,
      signUp
    };
  }

  function createQuestionStore(storeConfig) {
    const bucketName = (storeConfig && storeConfig.bucketName) || DEFAULT_BUCKET;
    const questionsTableName = (storeConfig && storeConfig.questionsTableName) || DEFAULT_QUESTIONS_TABLE;
    settingsTableName = (storeConfig && storeConfig.settingsTableName) || DEFAULT_SETTINGS_TABLE;

    async function open() {
      await requireUser();
      await loadSettings();
    }

    async function getAll() {
      const user = await requireUser();
      const { data, error } = await client
        .from(questionsTableName)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at_ms", { ascending: true });
      if (error) throw error;
      return Promise.all((data || []).map((row) => rowToQuestion(row, bucketName)));
    }

    async function put(question) {
      const user = await requireUser();
      const prepared = await prepareQuestionForStorage(question, bucketName);
      const row = questionToRow(prepared, user.id);
      const { error } = await client.from(questionsTableName).upsert(row, { onConflict: "user_id,id" });
      if (error) throw error;
      Object.assign(question, prepared, {
        questionImages: await resolveImageUrls(bucketName, prepared.questionImagePaths),
        answerImages: await resolveImageUrls(bucketName, prepared.answerImagePaths)
      });
    }

    async function remove(id) {
      const user = await requireUser();
      const existing = await getQuestionRow(id, questionsTableName, user.id);
      const { error } = await client.from(questionsTableName).delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      await removeStoragePaths(bucketName, imagePathsFromRow(existing));
    }

    async function clear() {
      const user = await requireUser();
      const { data, error: readError } = await client.from(questionsTableName).select("question_image_paths, answer_image_paths").eq("user_id", user.id);
      if (readError) throw readError;
      const { error } = await client.from(questionsTableName).delete().eq("user_id", user.id);
      if (error) throw error;
      await removeStoragePaths(bucketName, (data || []).flatMap(imagePathsFromRow));
    }

    return { clear, open, getAll, put, remove };
  }

  async function getQuestionRow(id, tableName, userId) {
    const { data, error } = await client.from(tableName).select("question_image_paths, answer_image_paths").eq("id", id).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  function imagePathsFromRow(row) {
    if (!row) return [];
    return [...arrayValue(row.question_image_paths), ...arrayValue(row.answer_image_paths)].filter(isStoragePath);
  }

  function arrayValue(value) {
    return Array.isArray(value) ? value : [];
  }

  function questionToRow(question, userId) {
    return {
      id: question.id,
      user_id: userId,
      category: question.category,
      subject: question.subject,
      type: question.type,
      title: question.title || "",
      created_at_ms: Number(question.createdAt || Date.now()),
      source_id: question.sourceId || "",
      source_name: question.sourceName || "",
      question_image_paths: arrayValue(question.questionImagePaths),
      answer_image_paths: arrayValue(question.answerImagePaths),
      note: question.note || "",
      updated_at: new Date().toISOString()
    };
  }

  async function rowToQuestion(row, bucketName) {
    const questionImagePaths = arrayValue(row.question_image_paths);
    const answerImagePaths = arrayValue(row.answer_image_paths);
    return {
      id: row.id,
      category: row.category,
      subject: row.subject,
      type: row.type,
      title: row.title || "",
      createdAt: Number(row.created_at_ms || Date.parse(row.created_at) || Date.now()),
      sourceId: row.source_id || "",
      sourceName: row.source_name || "",
      questionImagePaths,
      answerImagePaths,
      questionImages: await resolveImageUrls(bucketName, questionImagePaths),
      answerImages: await resolveImageUrls(bucketName, answerImagePaths),
      note: row.note || ""
    };
  }

  async function prepareQuestionForStorage(question, bucketName) {
    const id = question.id || `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const questionImagePaths = await prepareImagePaths(bucketName, id, "question", question.questionImages, question.questionImagePaths);
    const answerImagePaths = await prepareImagePaths(bucketName, id, "answer", question.answerImages, question.answerImagePaths);
    return {
      ...question,
      id,
      questionImagePaths,
      answerImagePaths
    };
  }

  async function prepareImagePaths(bucketName, questionId, kind, images, existingPaths) {
    const values = arrayValue(images);
    const knownPaths = arrayValue(existingPaths);
    const paths = [];

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (isDataUrl(value)) {
        paths.push(await uploadDataUrl(bucketName, value, questionId, kind, index));
        continue;
      }
      const parsedPath = storagePathFromUrl(bucketName, value);
      paths.push(parsedPath || knownPaths[index] || value);
    }

    if (values.length === 0 && knownPaths.length > 0) return knownPaths;
    return paths.filter(Boolean);
  }

  function isDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:image/");
  }

  function isStoragePath(value) {
    return typeof value === "string" && value && !value.startsWith("http") && !value.startsWith("data:");
  }

  function storagePathFromUrl(bucketName, value) {
    if (typeof value !== "string") return "";
    const markers = [`/storage/v1/object/sign/${bucketName}/`, `/storage/v1/object/public/${bucketName}/`];
    const marker = markers.find((item) => value.includes(item));
    if (!marker) return isStoragePath(value) ? value : "";
    return decodeURIComponent(value.split(marker)[1].split("?")[0]);
  }

  async function uploadDataUrl(bucketName, dataUrl, questionId, kind, index) {
    const user = await requireUser();
    const { blob, extension, mimeType } = dataUrlToBlob(dataUrl);
    const random = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${user.id}/${questionId}/${kind}-${index + 1}-${random}.${extension}`;
    const { error } = await client.storage.from(bucketName).upload(path, blob, {
      contentType: mimeType,
      upsert: false
    });
    if (error) throw error;
    return path;
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, payload] = dataUrl.split(",");
    const mimeType = (meta.match(/data:(.*?);base64/) || [])[1] || "image/png";
    const extension = mimeType.split("/")[1] || "png";
    const binary = atob(payload || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return {
      blob: new Blob([bytes], { type: mimeType }),
      extension: extension === "jpeg" ? "jpg" : extension,
      mimeType
    };
  }

  async function resolveImageUrls(bucketName, paths) {
    const urls = [];
    for (const path of arrayValue(paths)) {
      if (!isStoragePath(path)) {
        urls.push(path);
        continue;
      }
      const { data, error } = await client.storage.from(bucketName).createSignedUrl(path, SIGNED_URL_TTL);
      urls.push(error ? "" : data.signedUrl);
    }
    return urls.filter(Boolean);
  }

  async function removeStoragePaths(bucketName, paths) {
    const cleanPaths = [...new Set(arrayValue(paths).filter(isStoragePath))];
    if (cleanPaths.length === 0) return;
    for (let index = 0; index < cleanPaths.length; index += 100) {
      const chunk = cleanPaths.slice(index, index + 100);
      const { error } = await client.storage.from(bucketName).remove(chunk);
      if (error) console.error("删除截图失败", error);
    }
  }

  window.WQStorage = {
    createAuthStore,
    createQuestionStore,
    readJson,
    writeJson
  };
})();
