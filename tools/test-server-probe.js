const http = require("node:http");

// A listening port is not enough: only our explicit response marker identifies
// a game server. Probing never stops a server or makes a control request.
function probeGameServer(url, { timeoutMs = 1000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Server probe timeout must be a positive finite number");
  }
  return new Promise((resolve) => {
    let request;
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      // Only headers are needed. A foreign/hung streaming body must not keep
      // the probe, socket or Node process alive after a result is known.
      request?.destroy();
      resolve(result);
    };
    const deadline = setTimeout(() => finish({
      state: "rejected", code: "ETIMEDOUT",
      reason: `No complete HTTP response headers within ${timeoutMs} ms`,
    }), timeoutMs);
    try {
      request = http.get(url, { agent: false }, (response) => {
        response.on("error", () => {});
        const statusCode = response.statusCode || 0;
        const marker = response.headers["x-sunny-town-server"];
        if (statusCode === 200 && marker === "1") {
          finish({ state: "ready", statusCode });
        } else {
          finish({
            state: "rejected", statusCode,
            reason: `HTTP ${statusCode}, X-Sunny-Town-Server=${marker === undefined ? "missing" : JSON.stringify(marker)}; expected HTTP 200 and X-Sunny-Town-Server=1`,
          });
        }
      });
      request.on("error", (error) => finish({
        // Only an explicit connection refusal permits starting our own server.
        // Timeouts and protocol/DNS failures do not prove that a port is free.
        state: error.code === "ECONNREFUSED" ? "unavailable" : "rejected",
        code: error.code || "REQUEST_ERROR", reason: error.message,
      }));
    } catch (error) {
      finish({ state: "rejected", code: error.code || "REQUEST_ERROR", reason: error.message });
    }
  });
}

module.exports = { probeGameServer };
