const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ========== 配置 ==========
const PAYJS_MCHID = "你的商户号";
const PAYJS_KEY = "你的密钥";
const PORT = 3456;
const DATA_DIR = path.join(__dirname, "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const USERS_DIR = path.join(DATA_DIR, "users");

// 确保目录存在
if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });

// ========== 文件存储 ==========
function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function loadAccounts() {
  return readJSON(ACCOUNTS_FILE) || {};
}

function saveAccounts(accs) {
  writeJSON(ACCOUNTS_FILE, accs);
}

function loadUserData(accountId) {
  return readJSON(path.join(USERS_DIR, accountId + ".json"));
}

function saveUserData(accountId, data) {
  writeJSON(path.join(USERS_DIR, accountId + ".json"), data);
}

function hashPassword(pwd) {
  return crypto.createHash("sha256").update("salt_" + pwd).digest("hex");
}

// ========== 工具函数 ==========
function isPayConfigured() {
  return PAYJS_MCHID !== "你的商户号" && PAYJS_KEY !== "你的密钥" && PAYJS_MCHID && PAYJS_KEY;
}

function payjsSign(params) {
  const sorted = Object.keys(params).sort();
  const str = sorted.map((k) => k + "=" + params[k]).join("&") + "&key=" + PAYJS_KEY;
  return crypto.createHash("md5").update(str, "utf8").digest("hex").toUpperCase();
}

function payjsRequest(path, params) {
  return new Promise((resolve, reject) => {
    params.mchid = PAYJS_MCHID;
    params.sign = payjsSign(params);
    const body = new URLSearchParams(params).toString();

    const req = https.request(
      {
        hostname: "payjs.cn",
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("PayJS 响应解析失败: " + data));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ========== 订单存储（内存，重启丢失） ==========
const orders = {};

// ========== HTTP 服务 ==========
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

const server = http.createServer((req, res) => {
  function resJSON(code, obj) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  }

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");

  // ========== 账号 API ==========

  // 注册
  if (url.pathname === "/api/register" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { username, password, displayName } = JSON.parse(body);
        if (!username || !password) { resJSON(400, { error: "用户名和密码必填" }); return; }
        const accounts = loadAccounts();
        if (Object.values(accounts).some((a) => a.username === username)) {
          resJSON(400, { error: "用户名已存在" }); return;
        }
        const id = "u_" + Date.now().toString(36);
        accounts[id] = {
          id, username, displayName: displayName || username,
          passwordHash: hashPassword(password),
          createdAt: Date.now(),
          tier: "free", messageCountToday: 0, lastMessageDate: "",
        };
        saveAccounts(accounts);
        resJSON(200, { success: true, accountId: id, account: { id, username, displayName: accounts[id].displayName, tier: "free" } });
      } catch (e) { resJSON(400, { error: e.message }); }
    });
    return;
  }

  // 登录
  if (url.pathname === "/api/login" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { username, password } = JSON.parse(body);
        const accounts = loadAccounts();
        const found = Object.values(accounts).find(
          (a) => a.username === username && a.passwordHash === hashPassword(password)
        );
        if (!found) { resJSON(401, { error: "用户名或密码错误" }); return; }
        resJSON(200, { success: true, accountId: found.id, account: { id: found.id, username: found.username, displayName: found.displayName, tier: found.tier } });
      } catch (e) { resJSON(400, { error: e.message }); }
    });
    return;
  }

  // 获取用户数据
  if (url.pathname === "/api/load" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { accountId } = JSON.parse(body);
        const data = loadUserData(accountId);
        resJSON(200, { data: data || null });
      } catch (e) { resJSON(400, { error: e.message }); }
    });
    return;
  }

  // 保存用户数据
  if (url.pathname === "/api/save" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { accountId, data } = JSON.parse(body);
        saveUserData(accountId, data);
        resJSON(200, { success: true });
      } catch (e) { resJSON(400, { error: e.message }); }
    });
    return;
  }

  // 获取账号信息（VIP状态等）
  if (url.pathname === "/api/account" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { accountId } = JSON.parse(body);
        const accounts = loadAccounts();
        const acc = accounts[accountId];
        if (!acc) { resJSON(404, { error: "账号不存在" }); return; }
        // 检查VIP过期
        if (acc.tier === "vip_monthly" && acc.vipExpiry && acc.vipExpiry <= Date.now()) {
          acc.tier = "free"; delete acc.vipExpiry; saveAccounts(accounts);
        }
        const isVip = acc.tier === "vip_lifetime" || (acc.tier === "vip_monthly" && acc.vipExpiry > Date.now());
        resJSON(200, { username: acc.username, displayName: acc.displayName, tier: acc.tier, isVip, messageCountToday: acc.messageCountToday || 0, lastMessageDate: acc.lastMessageDate || "" });
      } catch (e) { resJSON(400, { error: e.message }); }
    });
    return;
  }

  // 更新账号（VIP升级、消息计数等）
  if (url.pathname === "/api/account-update" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { accountId, updates } = JSON.parse(body);
        const accounts = loadAccounts();
        if (!accounts[accountId]) { resJSON(404, { error: "账号不存在" }); return; }
        Object.assign(accounts[accountId], updates);
        saveAccounts(accounts);
        resJSON(200, { success: true });
      } catch (e) { resJSON(400, { error: e.message }); }
    });
    return;
  }

  // ========== PayJS 支付 ==========
  if (url.pathname === "/api/create-order" && req.method === "POST") {
    if (!isPayConfigured()) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "管理员尚未配置PayJS，请在 server.js 中填写商户号和密钥" }));
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const { amount, type } = JSON.parse(body);
        const totalFee = amount * 100; // PayJS 用分
        const outTradeNo = "VIP" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

        const result = await payjsRequest("/api/native", {
          body: type === "monthly" ? "月度VIP" : "终生VIP",
          out_trade_no: outTradeNo,
          total_fee: totalFee,
        });

        if (result.return_code === 1) {
          orders[outTradeNo] = { type, amount, paid: false, createdAt: Date.now() };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, code_url: result.code_url, qrcode: result.qrcode, outTradeNo }));
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: result.return_msg || "创建订单失败" }));
        }
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API: 查询支付状态
  if (url.pathname === "/api/check-order" && req.method === "POST") {
    if (!isPayConfigured()) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ paid: false }));
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const { outTradeNo } = JSON.parse(body);
        // 先查本地缓存
        if (orders[outTradeNo] && orders[outTradeNo].paid) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ paid: true, type: orders[outTradeNo].type }));
          return;
        }
        // 再查 PayJS
        const result = await payjsRequest("/api/check", { out_trade_no: outTradeNo });
        if (result.return_code === 1 && result.status === 1) {
          orders[outTradeNo] = orders[outTradeNo] || {};
          orders[outTradeNo].paid = true;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ paid: true, type: orders[outTradeNo].type }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ paid: false }));
        }
      } catch (err) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ paid: false }));
      }
    });
    return;
  }

  // PayJS 异步回调
  if (url.pathname === "/api/payjs-notify" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const params = Object.fromEntries(new URLSearchParams(body));
      const sign = params.sign;
      delete params.sign;
      if (payjsSign(params) === sign && params.return_code === "1") {
        orders[params.out_trade_no] = orders[params.out_trade_no] || {};
        orders[params.out_trade_no].paid = true;
        res.end("success");
      } else {
        res.end("fail");
      }
    });
    return;
  }

  // 静态文件
  const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  serveStatic(res, path.join(__dirname, filePath));
});

server.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
  if (PAYJS_MCHID === "你的商户号") {
    console.log("⚠ 请先在 server.js 中填写 PAYJS_MCHID 和 PAYJS_KEY");
    console.log("  未配置时点击支付会显示友好提示，不会报错");
  }
});
