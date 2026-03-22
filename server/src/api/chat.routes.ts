import { Router } from "express";
import { runReActLoop, ModelType } from "../agent/AgentRunner";
const router = Router();
router.post("/", async (req, res) => {
  try {
    const { repoId, message } = req.body;
    if (!repoId || !message) {
      return res.status(400).json({ error: "缺少必要参数" });
    }
    const answer = await runReActLoop(message, repoId, [], "deepseek");
    res.json({ answer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SSE 流式接口（POST 方法，支持历史消息）
router.post('/:repoId/stream', async (req, res) => {
  const { repoId } = req.params;
  const { message, history = [], model = "deepseek" } = req.body;

  // 参数校验（在设置 SSE 头之前）
  if (!repoId || !message) {
    return res.status(400).json({ error: "缺少必要参数" });
  }

  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const answer = await runReActLoop(message, repoId, history, model as ModelType, (step) => {
      // 发送每一步
      res.write(`data: ${JSON.stringify({ type: "step", step })}\n\n`);
    });

    // 发送最终答案
    res.write(`data: ${JSON.stringify({ type: "answer", content: answer })}\n\n`);
    res.end();
  } catch (error: any) {
    // SSE 连接已建立，不能用 res.status()，只能用 res.write()
    res.write(`data: ${JSON.stringify({ type: "error", content: error.message })}\n\n`);
    res.end();
  }
})
export default router;
