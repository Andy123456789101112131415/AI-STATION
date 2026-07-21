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
const settingHistoryAnalysis = $("#settingHistoryAnalysis");
const cmp1Name = $("#cmp1Name"); const cmp1Url = $("#cmp1Url");
const cmp1Key = $("#cmp1Key"); const cmp1Model = $("#cmp1Model");
const cmp2Name = $("#cmp2Name"); const cmp2Url = $("#cmp2Url");
const cmp2Key = $("#cmp2Key"); const cmp2Model = $("#cmp2Model");
const compareModelsSection = $("#compareModelsSection");
const inputToolbar = $("#inputToolbar");
const btnCompare = $("#btnCompare");
const btnAnalyze = $("#btnAnalyze");
const btnSaveSettings = $("#btnSaveSettings");
const btnCloseModal = $("#btnCloseModal");

/* ========== 状态 ========== */
const STORAGE_KEY = "ai_platform_data";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function defaultSettings() {
  return {
    aiName: "DeepSeek",
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    apiKey: "",
    model: "deepseek-chat",
    enableMultiModel: false,
    enableHistoryAnalysis: false,
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

let state = loadState() || defaultState();

// 兼容旧数据：如果 state 里有旧的 settings 字段，迁移到 globalSettings
if (state.settings && !state.globalSettings) {
  state.globalSettings = state.settings;
  delete state.settings;
}
// 兼容旧 chat：如果 chat 没有 settings，用 globalSettings 补上
state.chats.forEach((chat) => {
  if (!chat.settings) {
    chat.settings = { ...(state.globalSettings || defaultSettings()) };
  }
});
if (state.chats.some((c) => !c.settings)) {
  saveState(state);
}

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
  const anyOn = s.enableMultiModel || s.enableHistoryAnalysis;
  inputToolbar.style.display = anyOn ? "flex" : "none";
  btnCompare.style.display = s.enableMultiModel ? "" : "none";
  btnAnalyze.style.display = s.enableHistoryAnalysis ? "" : "none";
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
  chat.messages.push({ role: "user", content });
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
      chat.messages.push({ role: "assistant", content: mainResult.content, reasoning: mainResult.reasoning });
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

    const msg = { role: "assistant", content: fullContent };
    if (fullReasoning) msg.reasoning = fullReasoning;
    chat.messages.push(msg);
    saveState(state);
  } catch (err) {
    aiBody.classList.remove("streaming-cursor");
    if (thinking) thinking.section.remove();
    aiBody.innerHTML = renderMarkdown(`错误：${err.message}`);
    chat.messages.push({ role: "assistant", content: `错误：${err.message}` });
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

/* ========== 历史记录分析 ========== */
async function analyzeHistory() {
  const chat = getActiveChat();
  if (!chat || chat.messages.length < 2) {
    alert("当前对话消息不足，无法分析。");
    return;
  }

  const settings = getChatSettings();
  if (!settings.apiKey) { alert("请先配置 API 密钥。"); return; }

  setInputEnabled(false);
  btnAnalyze.textContent = "分析中...";

  // 构建对话摘要
  const conversationText = chat.messages
    .map((m) => `${m.role === "user" ? "用户" : "AI"}：${m.content}`)
    .join("\n\n");

  const sysMsg = {
    role: "system",
    content: `你是一个对话分析专家。请分析以下对话历史，给出简洁专业的分析报告。格式要求：
1. **对话主题**：一句话概括
2. **核心要点**：3-5个关键点
3. **用户意图**：用户主要想解决什么问题
4. **完成情况**：问题是否得到解决
5. **建议**：后续可深入的方向`,
  };

  let result = "";
  // 创建分析卡片
  const card = document.createElement("div");
  card.className = "analysis-card";
  card.innerHTML = `
    <div class="analysis-card-header">对话分析报告</div>
    <div class="analysis-card-body"><em>正在分析...</em></div>`;
  messages.appendChild(card);
  scrollToBottom();

  const body = card.querySelector(".analysis-card-body");

  try {
    await streamApiCall(
      settings,
      [sysMsg, { role: "user", content: `请分析以下对话：\n\n${conversationText}` }],
      null,
      (delta) => {
        result += delta;
        body.innerHTML = renderMarkdown(result);
        scrollToBottom();
      }
    );
    if (!result) body.innerHTML = "分析未返回结果。";
  } catch (err) {
    body.innerHTML = `分析失败：${escapeHtml(err.message)}`;
  }

  btnAnalyze.textContent = "历史分析";
  setInputEnabled(true);
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
  settingHistoryAnalysis.checked = !!s.enableHistoryAnalysis;
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
  chat.settings.enableHistoryAnalysis = settingHistoryAnalysis.checked;
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
btnAnalyze.addEventListener("click", analyzeHistory);
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
applySettingsToUI();
renderChatList();
renderMessages();

// 默认打开一个对话
if (state.chats.length === 0) {
  newChat();
}
