import { DeepSeekClient } from "../../llm/DeepSeekClients";
import { PlannerDecision, SkillMetadata } from "./SkillMetadata";

function safeParseJson(text: string): any {
  try {
    const fenced = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (fenced) {
      return JSON.parse(fenced[1]);
    }
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export class WorkflowPlanner {
  constructor(private llmClient: DeepSeekClient) {}

  async plan(params: {
    question: string;
    skills: SkillMetadata[];
    repoSummary?: string;
  }): Promise<PlannerDecision> {
    const prompt = this.buildPrompt(params);
    const response = await this.llmClient.chat(
      [
        {
          role: "system",
          content:
            "你是严谨的 workflow planner。你只能从给定 skill 列表中选择 skill id，并返回严格 JSON。",
        },
        { role: "user", content: prompt },
      ],
      {
        temperature: 0.1,
        maxTokens: 1200,
      },
    );

    return this.normalizeDecision(
      safeParseJson(response.content || "{}"),
      params.skills,
    );
  }

  private buildPrompt(params: {
    question: string;
    skills: SkillMetadata[];
    repoSummary?: string;
  }): string {
    return `
用户问题：
${params.question}

仓库摘要：
${params.repoSummary || "暂无"}

可用 skills：
${JSON.stringify(params.skills, null, 2)}

任务：
1. 判断这个问题是否值得启动 workflow
2. 如果需要，只能从给定 skills 中选择 skill id
3. 不要发明新的 skill
4. 不要补 dependsOn，系统会自行补全
5. 如果只是简单寒暄、泛泛聊天、无需代码库分析，就返回 answer_directly

只返回 JSON：
{
  "mode": "answer_directly" | "run_workflow",
  "goal": "一句话说明分析目标",
  "skillIds": ["skill_id"],
  "reason": "一句话说明选择原因"
}
`.trim();
  }

  private normalizeDecision(
    raw: any,
    skills: SkillMetadata[],
  ): PlannerDecision {
    const validSkillIds = new Set(skills.map((skill) => skill.id));
    const selectedSkillIds = Array.isArray(raw?.skillIds)
      ? raw.skillIds.filter((id: string) => validSkillIds.has(id))
      : [];

    const mode =
      raw?.mode === "run_workflow" && selectedSkillIds.length > 0
        ? "run_workflow"
        : "answer_directly";

    return {
      mode,
      goal:
        typeof raw?.goal === "string" && raw.goal.trim()
          ? raw.goal.trim()
          : "根据用户问题选择合适的仓库分析技能",
      skillIds: selectedSkillIds,
      reason: typeof raw?.reason === "string" ? raw.reason : "",
    };
  }
}
