import { Router } from "express";
import { runReActLoop } from "../agent/AgentRunner";
const router = Router();
router.post("/", async (req, res) => {
  try {
    const { repoId, message } = req.body;
    if (!repoId || !message) {
      return res.status(400).json({ error: "缺少必要参数" });
    }
    const answer = await runReActLoop(message, repoId);
    res.json({ answer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/stream', async (req, res) => {
  const { repoId, message } = req.body;

  // 参数校验（在设置 SSE 头之前）
  if (!repoId || !message) {
    return res.status(400).json({ error: "缺少必要参数" });
  }

  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const answer = await runReActLoop(message, repoId, (step) => {
      res.write(`data: ${JSON.stringify(step)}\n\n`);
    });

    // 发送最终答案
    res.write(`data: ${JSON.stringify({ type: "done", content: answer })}\n\n`);
    res.end();
  } catch (error: any) {
    // SSE 连接已建立，不能用 res.status()，只能用 res.write()
    res.write(`data: ${JSON.stringify({ type: "error", content: error.message })}\n\n`);
    res.end();
  }
})
export default router;
