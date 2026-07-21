const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ========== 配置 ==========
// 在 payjs.cn 注册后替换这里
const PAYJS_MCHID = "你的商户号";
const PAYJS_KEY = "你的密钥";
const PORT = 3456;

// ========== PayJS 工具 ==========
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

  // API: 创建支付订单
  if (url.pathname === "/api/create-order" && req.method === "POST") {
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
  console.log(`请先在 payjs.cn 注册并填写 PAYJS_MCHID 和 PAYJS_KEY`);
});
