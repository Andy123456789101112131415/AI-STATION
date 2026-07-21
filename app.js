/* ========== DOM 引用 ========== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const sidebar = $("#sidebar");
const chatList = $("#chatList");
const messages = $("#messages");
const userInput = $("#userInput");
const btnSend = $("#btnSend");
const btnNewChat = $("#btnNewChat");
const btnSettings = $("#btnSettings");
const btnToggleSidebar = $("#btnToggleSidebar");
const aiNameDisplay = $("#aiNameDisplay");
const modalOverlay = $("#modalOverlay");
const settingAiName = $("#settingAiName");
const settingApiUrl = $("#settingApiUrl");
const settingApiKey = $("#settingApiKey");
const settingModel = $("#settingModel");
const settingMultiModel = $("#settingMultiModel");
const settingHistoryAnalysis = $("#settingStats");
const cmp1Name = $("#cmp1Name"); const cmp1Url = $("#cmp1Url");
const cmp1Key = $("#cmp1Key"); const cmp1Model = $("#cmp1Model");
const cmp2Name = $("#cmp2Name"); const cmp2Url = $("#cmp2Url");
const cmp2Key = $("#cmp2Key"); const cmp2Model = $("#cmp2Model");
const compareModelsSection = $("#compareModelsSection");
const inputToolbar = $("#inputToolbar");
const btnCompare = $("#btnCompare");
const btnAnalyze = $("#btnStats");
const btnSaveSettings = $("#btnSaveSettings");
const btnCloseModal = $("#btnCloseModal");

/* ========== 账号管理 ========== */
const ACCOUNTS_KEY = "ai_platform_accounts";
const SESSION_KEY = "ai_platform_session";

function hashPassword(pwd) {
  // 简单哈希（客户端本地存储，非安全用途）
  let h = 0;
  for (let i = 0; i < pwd.length; i++) {
    h = ((h << 5) - h + pwd.charCodeAt(i)) | 0;
  }
  return "p_" + Math.abs(h).toString(36);
}

function loadAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAccounts(accs) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accs));
}

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setSession(accountId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId, loginTime: Date.now() }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// 迁移旧数据：如果存在旧格式数据但没有账号，自动创建默认账号
function migrateOldData() {
  const oldData = localStorage.getItem("ai_platform_data");
  const accounts = loadAccounts();
  if (oldData && Object.keys(accounts).length === 0) {
    const defaultId = "default_user";
    accounts[defaultId] = {
      id: defaultId,
      username: "admin",
      displayName: "管理员",
      passwordHash: hashPassword("admin123"),
      createdAt: Date.now(),
    };
    saveAccounts(accounts);
    setSession(defaultId);
    // 旧数据保留在原 key 下，后续 getAccountData 会读取
  }
}

function getAccountData(accountId) {
  const key = "ai_platform_data_" + accountId;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  // 尝试迁移旧数据
  const oldData = localStorage.getItem("ai_platform_data");
  if (oldData && accountId === "default_user") {
    try { return JSON.parse(oldData); } catch {}
  }
  return null;
}

function saveAccountData(accountId, data) {
  localStorage.setItem("ai_platform_data_" + accountId, JSON.stringify(data));
}

// 账号 UI
const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const regUsername = document.getElementById("regUsername");
const regDisplayName = document.getElementById("regDisplayName");
const regPassword = document.getElementById("regPassword");
const regPassword2 = document.getElementById("regPassword2");
const registerError = document.getElementById("registerError");
const accountSection = document.getElementById("accountSection");
const accountAvatar = document.getElementById("accountAvatar");
const accountName = document.getElementById("accountName");
const accountDropdown = document.getElementById("accountDropdown");
const btnAccountMenu = document.getElementById("btnAccountMenu");
const btnSwitchAccount = document.getElementById("btnSwitchAccount");
const btnLogout = document.getElementById("btnLogout");

// Tab 切换
document.querySelectorAll(".login-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".login-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.tab;
    loginForm.style.display = target === "login" ? "" : "none";
    registerForm.style.display = target === "register" ? "" : "none";
    loginError.textContent = "";
    registerError.textContent = "";
  });
});

// 登录
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = loginUsername.value.trim();
  const pwd = loginPassword.value;
  const accounts = loadAccounts();
  const found = Object.values(accounts).find(
    (a) => a.username === username && a.passwordHash === hashPassword(pwd)
  );
  if (!found) {
    loginError.textContent = "用户名或密码错误";
    return;
  }
  setSession(found.id);
  loginOverlay.classList.remove("show");
  loginUsername.value = "";
  loginPassword.value = "";
  loginError.textContent = "";
  initApp();
});

// 注册
registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = regUsername.value.trim();
  const displayName = regDisplayName.value.trim() || username;
  const pwd = regPassword.value;
  const pwd2 = regPassword2.value;
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,20}$/.test(username)) {
    registerError.textContent = "用户名需3-20位字母、数字、中文或下划线";
    return;
  }
  if (pwd.length < 6) {
    registerError.textContent = "密码至少6位";
    return;
  }
  if (pwd !== pwd2) {
    registerError.textContent = "两次密码不一致";
    return;
  }
  const accounts = loadAccounts();
  if (Object.values(accounts).some((a) => a.username === username)) {
    registerError.textContent = "用户名已存在";
    return;
  }
  const id = "u_" + Date.now().toString(36);
  accounts[id] = {
    id, username, displayName,
    passwordHash: hashPassword(pwd),
    createdAt: Date.now(),
  };
  saveAccounts(accounts);
  setSession(id);
  loginOverlay.classList.remove("show");
  regUsername.value = "";
  regDisplayName.value = "";
  regPassword.value = "";
  regPassword2.value = "";
  registerError.textContent = "";
  initApp();
});

// 账号菜单
btnAccountMenu.addEventListener("click", (e) => {
  e.stopPropagation();
  accountDropdown.style.display = accountDropdown.style.display === "none" ? "" : "none";
});

document.addEventListener("click", () => {
  accountDropdown.style.display = "none";
});

btnSwitchAccount.addEventListener("click", () => {
  clearSession();
  accountDropdown.style.display = "none";
  location.reload();
});

btnLogout.addEventListener("click", () => {
  clearSession();
  accountDropdown.style.display = "none";
  location.reload();
});

function renderAccountUI() {
  const session = getSession();
  if (!session) {
    accountAvatar.textContent = "?";
    accountName.textContent = "未登录";
    loginOverlay.classList.add("show");
    return;
  }
  const accounts = loadAccounts();
  const acc = accounts[session.accountId];
  if (!acc) {
    clearSession();
    location.reload();
    return;
  }
  accountAvatar.textContent = (acc.displayName || acc.username).charAt(0).toUpperCase();
  accountName.textContent = acc.displayName || acc.username;
  loginOverlay.classList.remove("show");
}

/* ========== 状态（账号隔离） ========== */
function getStorageKey() {
  const session = getSession();
  return session ? "ai_platform_data_" + session.accountId : "ai_platform_data";
}

function loadState() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveState(st) {
  localStorage.setItem(getStorageKey(), JSON.stringify(st));
}

function defaultSettings() {
  return {
    aiName: "DeepSeek",
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    apiKey: "",
    model: "deepseek-chat",
    enableMultiModel: false,
    enableStats: false,
    compareModels: [
      { aiName: "", apiUrl: "", apiKey: "", model: "" },
      { aiName: "", apiUrl: "", apiKey: "", model: "" },
    ],
  };
}

function defaultState() {
  return {
    // globalSettings: 新建 Chat 时的默认模板
    globalSettings: defaultSettings(),
    // 每个 chat 自带独立 settings
    chats: [],
    activeChatId: null,
  };
}

let state = null;

/* ========== 获取当前活跃 Chat 的 settings ========== */
function getChatSettings() {
  const chat = getActiveChat();
  if (chat && chat.settings) return chat.settings;
  if (state.globalSettings) return state.globalSettings;
  // 兜底：返回默认配置
  return defaultSettings();
}

/* ========== 初始化设置显示 ========== */
function applySettingsToUI() {
  const s = getChatSettings();
  if (!s) return;
  aiNameDisplay.textContent = (s.aiName || "未配置AI") + (state.chats.length > 1 ? "  (当前对话)" : "");
  settingAiName.value = s.aiName || "";
  settingApiUrl.value = s.apiUrl || "";
  settingApiKey.value = s.apiKey || "";
  settingModel.value = s.model || "";
  // 工具栏可见性
  const anyOn = s.enableMultiModel || s.enableStats;
  inputToolbar.style.display = anyOn ? "flex" : "none";
  btnCompare.style.display = s.enableMultiModel ? "" : "none";
  btnAnalyze.style.display = s.enableStats ? "" : "none";
  updateCompareBtnState();
}

/* ========== 对话管理 ========== */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createChat(fromSettings) {
  const base = fromSettings || state.globalSettings;
  return {
    id: generateId(),
    title: `新对话`,
    messages: [],
    // 每个 chat 独立拷贝一份 settings
    settings: { ...base },
  };
}

function getActiveChat() {
  if (!state.activeChatId) return null;
  return state.chats.find((c) => c.id === state.activeChatId) || null;
}

function setActiveChat(chatId) {
  state.activeChatId = chatId;
  saveState(state);
}

/* ========== 渲染侧边栏对话列表 ========== */
function renderChatList() {
  chatList.innerHTML = "";
  state.chats.forEach((chat) => {
    const div = document.createElement("div");
    div.className = "chat-list-item" + (chat.id === state.activeChatId ? " active" : "");
    div.title = `${chat.title}\nAI: ${chat.settings.aiName || "未配置"}`;

    const left = document.createElement("div");
    left.style.cssText = "flex:1;overflow:hidden;display:flex;flex-direction:column;gap:2px;";

    const titleSpan = document.createElement("span");
    titleSpan.textContent = chat.title;
    titleSpan.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

    const aiBadge = document.createElement("span");
    aiBadge.textContent = (chat.settings && chat.settings.aiName) || "未配置";
    aiBadge.style.cssText = "font-size:10px;color:var(--accent);opacity:.8;";

    left.appendChild(titleSpan);
    left.appendChild(aiBadge);

    left.addEventListener("click", () => switchChat(chat.id));

    const delBtn = document.createElement("button");
    delBtn.className = "delete-chat";
    delBtn.textContent = "\u00D7";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });

    div.appendChild(left);
    div.appendChild(delBtn);
    chatList.appendChild(div);
  });
}

function switchChat(chatId) {
  setActiveChat(chatId);
  applySettingsToUI();
  renderChatList();
  renderMessages();
}

function deleteChat(chatId) {
  state.chats = state.chats.filter((c) => c.id !== chatId);
  if (state.activeChatId === chatId) {
    state.activeChatId = state.chats.length > 0 ? state.chats[0].id : null;
  }
  saveState(state);
  renderChatList();
  renderMessages();
}

function newChat() {
  const current = getActiveChat();
  const chat = createChat(current ? current.settings : null);
  state.chats.unshift(chat);
  setActiveChat(chat.id);
  saveState(state);
  applySettingsToUI();
  renderChatList();
  renderMessages();
  userInput.focus();
}

/* ========== 渲染消息 ========== */
function renderMessages() {
  const chat = getActiveChat();
  messages.innerHTML = "";

  if (!chat || chat.messages.length === 0) {
    messages.innerHTML = `
      <div class="welcome">
        <h2>欢迎使用自定义AI平台</h2>
        <p>请先在左侧「API 设置」中配置你的 AI 名称和 API 密钥，然后开始对话。</p>
      </div>`;
    return;
  }

  chat.messages.forEach((msg) => {
    appendMessageBubble(msg.role, msg.content, false, msg.reasoning || "");
  });
  scrollToBottom();
}

function createThinkingSection() {
  const section = document.createElement("div");
  section.className = "thinking-section";

  const header = document.createElement("div");
  header.className = "thinking-header";
  header.textContent = "思考中...";
  header.addEventListener("click", () => {
    section.classList.toggle("collapsed");
  });

  const body = document.createElement("div");
  body.className = "thinking-body";

  section.appendChild(header);
  section.appendChild(body);
  return { section, header, body };
}

function appendMessageBubble(role, content, isStreaming = false, reasoning = "") {
  // 移除欢迎页
  const welcome = messages.querySelector(".welcome");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = `message ${role}`;

  const label = document.createElement("span");
  label.className = "role-label";
  label.textContent = role === "user" ? "你" : (getChatSettings().aiName || "AI");
  div.appendChild(label);

  let thinking = null;
  if (role === "ai") {
    // 创建思考区域
    const ts = createThinkingSection();
    thinking = ts;
    if (reasoning) {
      ts.body.innerHTML = renderMarkdown(reasoning);
      ts.header.innerHTML = `<span class="thinking-icon">&#9660;</span> 思考过程`;
    }
    div.appendChild(ts.section);
  }

  const body = document.createElement("div");
  body.className = "message-body";
  if (role === "ai") {
    body.innerHTML = renderMarkdown(content);
  } else {
    body.textContent = content;
  }

  if (isStreaming && !content) {
    body.classList.add("streaming-cursor");
  }

  div.appendChild(body);
  messages.appendChild(div);
  scrollToBottom();
  return { div, body, thinking };
}

/* ========== 简易 Markdown 渲染 ========== */
function renderMarkdown(text) {
  // 转义 HTML
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 代码块 ```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // 行内代码 `
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 粗体 **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // 斜体 *text*
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // 换行
  html = html.replace(/\n/g, "<br>");

  return html;
}

/* ========== 滚动 ========== */
function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

/* ========== API 调用 ========== */
async function sendMessage() {
  const content = userInput.value.trim();
  if (!content) return;

  const settings = getChatSettings();
  if (!settings.apiKey) {
    alert("请先在设置中填写 API 密钥。");
    openSettings();
    return;
  }
  if (!settings.apiUrl) {
    alert("请先在设置中填写 API 地址。");
    openSettings();
    return;
  }

  // 确保有活跃对话
  let chat = getActiveChat();
  if (!chat) {
    newChat();
    chat = getActiveChat();
  }

  // 添加用户消息
  chat.messages.push({ role: "user", content, timestamp: Date.now() });
  appendMessageBubble("user", content);
  userInput.value = "";
  userInput.style.height = "auto";

  // 更新标题
  if (chat.messages.length === 1) {
    chat.title = content.slice(0, 20) + (content.length > 20 ? "..." : "");
    renderChatList();
  }

  // 对比模式：发送到多个模型
  if (compareMode) {
    setInputEnabled(false);
    const mainResult = await sendCompareMessages(content);
    if (mainResult) {
      chat.messages.push({ role: "assistant", content: mainResult.content, reasoning: mainResult.reasoning, timestamp: Date.now() });
      saveState(state);
    }
    setInputEnabled(true);
    userInput.focus();
    return;
  }

  // 禁用输入
  setInputEnabled(false);

  // 创建 AI 消息气泡（流式）
  const { div: aiDiv, body: aiBody, thinking } = appendMessageBubble("ai", "", true);

  // 构建消息历史
  const apiMessages = chat.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const response = await fetch(settings.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || "deepseek-chat",
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    // 读取 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let fullReasoning = "";
    let buffer = "";
    let thinkingDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;

          // 思考内容 (DeepSeek R1 等模型的 reasoning_content)
          if (delta.reasoning_content) {
            fullReasoning += delta.reasoning_content;
            if (thinking) {
              thinking.body.innerHTML = renderMarkdown(fullReasoning);
              thinking.header.innerHTML = `<span class="thinking-icon">&#9660;</span> 思考中...`;
              scrollToBottom();
            }
          }

          // 正文内容
          if (delta.content) {
            // 思考结束，折叠思考区域
            if (!thinkingDone && fullReasoning && thinking) {
              thinkingDone = true;
              thinking.section.classList.add("collapsed");
              thinking.header.innerHTML = `<span class="thinking-icon">&#9654;</span> 思考过程`;
              aiBody.classList.add("streaming-cursor");
            }
            fullContent += delta.content;
            aiBody.innerHTML = renderMarkdown(fullContent);
            scrollToBottom();
          }
        } catch {
          // 忽略解析失败的行
        }
      }
    }

    // 流结束
    aiBody.classList.remove("streaming-cursor");

    // 如果没有思考内容，移除空的思考区域
    if (!fullReasoning && thinking) {
      thinking.section.remove();
    }
    // 如果只有思考没有正文
    if (!fullContent && fullReasoning) {
      aiBody.innerHTML = renderMarkdown(fullReasoning);
      thinking.section.remove();
      fullContent = fullReasoning;
      fullReasoning = "";
    }
    if (!fullContent && !fullReasoning) {
      aiBody.innerHTML = "(AI 未返回内容)";
    }

    const msg = { role: "assistant", content: fullContent, timestamp: Date.now() };
    if (fullReasoning) msg.reasoning = fullReasoning;
    chat.messages.push(msg);
    saveState(state);
  } catch (err) {
    aiBody.classList.remove("streaming-cursor");
    if (thinking) thinking.section.remove();
    aiBody.innerHTML = renderMarkdown(`错误：${err.message}`);
    chat.messages.push({ role: "assistant", content: `错误：${err.message}`, timestamp: Date.now() });
    saveState(state);
    console.error(err);
  }

  setInputEnabled(true);
  userInput.focus();
}

function setInputEnabled(enabled) {
  userInput.disabled = !enabled;
  btnSend.disabled = !enabled;
  btnCompare.disabled = !enabled;
  btnAnalyze.disabled = !enabled;
}

/* ========== 流式 API 通用调用 ========== */
async function streamApiCall(apiSettings, messagesToSend, onReasoning, onContent) {
  const response = await fetch(apiSettings.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiSettings.apiKey}`,
    },
    body: JSON.stringify({
      model: apiSettings.model,
      messages: messagesToSend,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content);
        if (delta.content && onContent) onContent(delta.content);
      } catch { /* ignore */ }
    }
  }
}

/* ========== 多模型对比 ========== */
let compareMode = false;

function updateCompareBtnState() {
  const s = getChatSettings();
  if (s.enableMultiModel) {
    btnCompare.classList.toggle("active", compareMode);
  }
}

function toggleCompare() {
  const s = getChatSettings();
  const cms = s.compareModels || [];
  const hasCmp = cms.some((c) => c.aiName && c.apiKey);
  if (!hasCmp) {
    alert("请先在设置中配置至少一个对比模型。");
    openSettings();
    return;
  }
  compareMode = !compareMode;
  updateCompareBtnState();
  userInput.placeholder = compareMode
    ? "对比模式已开启 - 将同时发送到多个模型..."
    : "输入你的消息... (Enter 发送, Shift+Enter 换行)";
  userInput.focus();
}

async function sendCompareMessages(content) {
  const chat = getActiveChat();
  const settings = getChatSettings();
  const cms = (settings.compareModels || []).filter((c) => c.aiName && c.apiKey);

  // 主模型
  const mainSettings = {
    aiName: settings.aiName,
    apiUrl: settings.apiUrl,
    apiKey: settings.apiKey,
    model: settings.model,
  };

  const allModels = [mainSettings, ...cms];
  const colors = ["#4f6ef7", "#e0556a", "#22a699"];

  // 构建消息
  const apiMessages = chat.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  apiMessages.push({ role: "user", content });

  // 创建对比容器
  const container = document.createElement("div");
  container.className = "compare-container";

  const cards = allModels.map((model, i) => {
    const card = document.createElement("div");
    card.className = "compare-card";
    card.innerHTML = `
      <div class="compare-card-header">
        <span class="model-dot" style="background:${colors[i]}"></span>
        ${escapeHtml(model.aiName || "模型" + (i + 1))}
      </div>
      <div class="compare-card-body"><em>请求中...</em></div>`;
    container.appendChild(card);
    return { card, body: card.querySelector(".compare-card-body"), model };
  });

  messages.appendChild(container);
  scrollToBottom();

  // 并行请求所有模型
  const promises = cards.map(async ({ body, model }) => {
    let result = "";
    let reasoning = "";
    try {
      await streamApiCall(
        model,
        apiMessages,
        (r) => { reasoning += r; },
        (c) => {
          result += c;
          let html = "";
          if (reasoning) {
            html += `<details style="margin-bottom:8px"><summary style="color:#999;font-size:11px;cursor:pointer">思考过程</summary><div style="color:#999;font-size:12px;margin-top:4px">${renderMarkdown(reasoning)}</div></details>`;
          }
          html += renderMarkdown(result);
          body.innerHTML = html;
          scrollToBottom();
        }
      );
      if (!result) result = "(未返回内容)";
      return { role: "assistant", content: result, reasoning, modelName: model.aiName };
    } catch (err) {
      body.innerHTML = `<span style="color:var(--danger)">错误：${escapeHtml(err.message)}</span>`;
      return { role: "assistant", content: `错误：${err.message}`, modelName: model.aiName };
    }
  });

  const results = await Promise.all(promises);
  return results[0] || null;
}

/* ========== 使用统计 ========== */
const statsOverlay = document.getElementById("statsOverlay");
const btnCloseStats = document.getElementById("btnCloseStats");

function openStats() {
  renderStats();
  statsOverlay.classList.add("show");
}

btnCloseStats.addEventListener("click", () => {
  statsOverlay.classList.remove("show");
});

statsOverlay.addEventListener("click", (e) => {
  if (e.target === statsOverlay) statsOverlay.classList.remove("show");
});

function renderStats() {
  // 收集所有消息
  const allMsgs = [];
  state.chats.forEach((chat) => {
    chat.messages.forEach((msg) => {
      allMsgs.push({
        role: msg.role,
        model: (chat.settings && chat.settings.aiName) || "未知",
        timestamp: msg.timestamp || null,
      });
    });
  });

  const totalMessages = allMsgs.length;
  const totalChats = state.chats.length;
  const userMsgs = allMsgs.filter((m) => m.role === "user").length;
  const aiMsgs = allMsgs.filter((m) => m.role === "assistant").length;

  // 概览卡片
  document.getElementById("statsCards").innerHTML = `
    <div class="stat-card"><div class="stat-value">${totalChats}</div><div class="stat-label">对话总数</div></div>
    <div class="stat-card"><div class="stat-value">${totalMessages}</div><div class="stat-label">消息总数</div></div>
    <div class="stat-card"><div class="stat-value">${userMsgs}</div><div class="stat-label">用户消息</div></div>
    <div class="stat-card"><div class="stat-value">${aiMsgs}</div><div class="stat-label">AI 回复</div></div>
  `;

  // 模型使用占比
  const modelCount = {};
  allMsgs.filter((m) => m.role === "assistant").forEach((m) => {
    modelCount[m.model] = (modelCount[m.model] || 0) + 1;
  });

  const colors = ["#4f6ef7", "#e0556a", "#22a699", "#f2a649", "#8b5cf6", "#06b6d4"];
  const barChart = document.getElementById("statsBarChart");
  if (Object.keys(modelCount).length === 0) {
    barChart.innerHTML = '<span style="color:#999;font-size:13px">暂无数据</span>';
  } else {
    const maxCount = Math.max(...Object.values(modelCount));
    barChart.innerHTML = Object.entries(modelCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => {
        const h = Math.max((count / maxCount) * 140, 8);
        return `<div class="bar-item">
          <div class="bar-count">${count}</div>
          <div class="bar-fill" style="height:${h}px;background:${colors[i % colors.length]}"></div>
          <div class="bar-label">${escapeHtml(name)}</div>
        </div>`;
      })
      .join("");
  }

  // 模型详情表
  const tbody = document.querySelector("#statsTable tbody");
  tbody.innerHTML = Object.entries(modelCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => {
      const chatsUsingModel = state.chats.filter((c) =>
        c.messages.some((m) => m.role === "assistant")
      ).length || 0;
      const pct = aiMsgs > 0 ? ((count / aiMsgs) * 100).toFixed(1) : "0";
      return `<tr>
        <td><span class="model-dot-sm" style="background:${colors[i % colors.length]}"></span>${escapeHtml(name)}</td>
        <td>${count}</td>
        <td>${chatsUsingModel}</td>
        <td>${pct}%</td>
      </tr>`;
    })
    .join("") || '<tr><td colspan="4" style="color:#999">暂无数据</td></tr>';

  // 活跃度热力图（近12周）
  renderHeatmap(allMsgs);
}

function renderHeatmap(allMsgs) {
  const heatmap = document.getElementById("statsHeatmap");
  const now = new Date();
  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    const week = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - (w * 7 + d));
      const key = date.toISOString().slice(0, 10);
      week.push({ key, date: new Date(date), count: 0 });
    }
    weeks.push(week);
  }

  let totalMsgs = 0;
  allMsgs.forEach((msg) => {
    if (!msg.timestamp) return;
    const key = new Date(msg.timestamp).toISOString().slice(0, 10);
    weeks.forEach((week) => {
      week.forEach((cell) => {
        if (cell.key === key) { cell.count++; totalMsgs++; }
      });
    });
  });

  const levels = [0, 1, 3, 6, 10];
  const months = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

  // 构建月份标签行 - 用12个等宽单元格对齐
  const monthCells = [];
  let lastMonth = -1;
  for (let wi = 0; wi < 12; wi++) {
    const m = weeks[wi][6].date.getMonth();
    if (m !== lastMonth) {
      monthCells.push(`<span class="heatmap-month-label">${months[m]}</span>`);
      lastMonth = m;
    } else {
      monthCells.push(`<span class="heatmap-month-label"></span>`);
    }
  }
  const monthRow = `<div class="heatmap-row"><span class="heatmap-row-label"></span><div class="heatmap-week heatmap-month-week">${monthCells.join("")}</div></div>`;

  const dayLabels = ["一", "二", "三", "四", "五", "六", "日"];

  const gridRows = weeks[0]
    .map((_, dayIdx) => {
      const cells = weeks
        .map((week) => {
          const cell = week[6 - dayIdx];
          let lvl = 0;
          for (let l = levels.length - 1; l >= 0; l--) {
            if (cell.count >= levels[l]) { lvl = l; break; }
          }
          return `<div class="heatmap-cell l${lvl}" title="${cell.key}: ${cell.count} 条消息"></div>`;
        })
        .join("");
      const label = dayLabels[dayIdx] || "";
      return `<div class="heatmap-row"><span class="heatmap-row-label">${label}</span><div class="heatmap-week">${cells}</div></div>`;
    })
    .join("");

  heatmap.innerHTML = `
    <div class="heatmap-total">近12周共 ${totalMsgs} 条消息</div>
    ${monthRow}
    ${gridRows}
    <div class="heatmap-legend">
      少
      ${[0, 1, 2, 3, 4].map((l) => `<span class="heatmap-cell l${l}"></span>`).join("")}
      多
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ========== 设置弹窗 ========== */
function openSettings() {
  let chat = getActiveChat();
  if (!chat) { newChat(); chat = getActiveChat(); }
  const s = chat.settings;
  settingAiName.value = s.aiName || "";
  settingApiUrl.value = s.apiUrl || "";
  settingApiKey.value = s.apiKey || "";
  settingModel.value = s.model || "";
  settingMultiModel.checked = !!s.enableMultiModel;
  settingHistoryAnalysis.checked = !!s.enableStats;
  // 对比模型
  const cm = s.compareModels || [{}, {}];
  cmp1Name.value = cm[0]?.aiName || ""; cmp1Url.value = cm[0]?.apiUrl || "";
  cmp1Key.value = cm[0]?.apiKey || ""; cmp1Model.value = cm[0]?.model || "";
  cmp2Name.value = cm[1]?.aiName || ""; cmp2Url.value = cm[1]?.apiUrl || "";
  cmp2Key.value = cm[1]?.apiKey || ""; cmp2Model.value = cm[1]?.model || "";
  compareModelsSection.style.display = settingMultiModel.checked ? "" : "none";
  modalOverlay.classList.add("show");
}

settingMultiModel.addEventListener("change", () => {
  compareModelsSection.style.display = settingMultiModel.checked ? "" : "none";
});

function closeSettings() {
  modalOverlay.classList.remove("show");
}

function saveSettings() {
  const chat = getActiveChat();
  if (!chat) return;
  chat.settings.aiName = settingAiName.value.trim() || "AI";
  chat.settings.apiUrl = settingApiUrl.value.trim();
  chat.settings.apiKey = settingApiKey.value.trim();
  chat.settings.model = settingModel.value.trim() || "deepseek-chat";
  chat.settings.enableMultiModel = settingMultiModel.checked;
  chat.settings.enableStats = settingHistoryAnalysis.checked;
  chat.settings.compareModels = [
    { aiName: cmp1Name.value.trim(), apiUrl: cmp1Url.value.trim(), apiKey: cmp1Key.value.trim(), model: cmp1Model.value.trim() },
    { aiName: cmp2Name.value.trim(), apiUrl: cmp2Url.value.trim(), apiKey: cmp2Key.value.trim(), model: cmp2Model.value.trim() },
  ];
  saveState(state);
  applySettingsToUI();
  renderChatList();
  closeSettings();
}

/* ========== 侧边栏切换 ========== */
function toggleSidebar() {
  sidebar.classList.toggle("collapsed");
}

/* ========== 事件绑定 ========== */
btnSend.addEventListener("click", sendMessage);
btnNewChat.addEventListener("click", newChat);
btnSettings.addEventListener("click", openSettings);
btnToggleSidebar.addEventListener("click", toggleSidebar);
btnSaveSettings.addEventListener("click", saveSettings);
btnCloseModal.addEventListener("click", closeSettings);
btnCompare.addEventListener("click", toggleCompare);
btnAnalyze.addEventListener("click", openStats);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeSettings();
});

// 回车发送
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// 自动调整输入框高度
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + "px";
});

// 快捷键
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "b") {
    e.preventDefault();
    toggleSidebar();
  }
});

/* ========== 启动 ========== */
function initApp() {
  migrateOldData();
  renderAccountUI();

  // 检查登录状态
  const session = getSession();
  if (!session) {
    loginOverlay.classList.add("show");
    return; // 未登录，不加载数据
  }

  // 加载当前账号数据
  state = loadState() || defaultState();

  // 兼容旧 chat
  state.chats.forEach((chat) => {
    if (!chat.settings) {
      chat.settings = { ...(state.globalSettings || defaultSettings()) };
    }
  });

  applySettingsToUI();
  renderChatList();
  renderMessages();

  if (state.chats.length === 0) {
    newChat();
  }
}

// 启动
initApp();
