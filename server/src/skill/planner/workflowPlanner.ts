import { DeepSeekClient } from "../../llm/DeepSeekClients";
import { PlannerDecision, SkillMetadata } from "./SkillMetadata";

// 规划配置选项
interface PlannerOptions {
  maxSkills?: number;           // 最大 Skill 数量限制
  maxHighCostSkills?: number;   // 最大高成本 Skill 数量
  budgetLimit?: "low" | "medium" | "high";  // 预算限制
}

// 问题类型分类
type QuestionType =
  | "overview"           // 项目概览类
  | "architecture"       // 架构理解类
  | "trace_flow"         // 流程追踪类
  | "trace_api"          // API 追踪类
  | "debug"              // 调试类
  | "feature_request"    // 功能请求类
  | "simple_qa"          // 简单问答
  | "chitchat";          // 寒暄聊天

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
  private defaultOptions: PlannerOptions = {
    maxSkills: 5,
    maxHighCostSkills: 2,
    budgetLimit: "medium",
  };

  constructor(private llmClient: DeepSeekClient) {}

  async plan(params: {
    question: string;
    skills: SkillMetadata[];
    repoSummary?: string;
    options?: PlannerOptions;
  }): Promise<PlannerDecision> {
    const options = { ...this.defaultOptions, ...params.options };

    // 快速判断：简单问题直接返回
    const quickDecision = this.quickClassify(params.question);
    if (quickDecision === "chitchat" || quickDecision === "simple_qa") {
      return {
        mode: "answer_directly",
        goal: quickDecision === "chitchat" ? "简单寒暄" : "简单问答，无需深度分析",
        skillIds: [],
        reason: `问题类型判定为 ${quickDecision}，直接回答即可`,
      };
    }

    const prompt = this.buildEnhancedPrompt(params, options, quickDecision);
    const response = await this.llmClient.chat(
      [
        {
          role: "system",
          content: this.getSystemPrompt(),
        },
        { role: "user", content: prompt },
      ],
      {
        temperature: 0.1,
        maxTokens: 1200,
      },
    );

    const rawDecision = safeParseJson(response.content || "{}");
    return this.normalizeDecision(rawDecision, params.skills, options);
  }

  /**
   * 快速分类问题类型，用于简单问题的快速判断
   */
  private quickClassify(question: string): QuestionType {
    const lowerQuestion = question.toLowerCase().trim();

    // 寒暄类
    const chitchatPatterns = [
      /^(你好|hi|hello|hey|嗨|早上好|下午好|晚上好)/,
      /^(谢谢|感谢|thanks|thank you)/,
      /^(再见|拜拜|bye|goodbye)/,
      /^(怎么样|如何|什么)/,
    ];
    if (chitchatPatterns.some(p => p.test(lowerQuestion))) {
      return "chitchat";
    }

    // 简单问答类 - 单个概念解释
    const simpleQaPatterns = [
      /^(什么是|what is|解释一下|explain)/,
      /^(怎么用|how to use)/,
      /^.{1,20}$/,  // 非常短的问题
    ];
    if (simpleQaPatterns.some(p => p.test(lowerQuestion)) && lowerQuestion.length < 50) {
      return "simple_qa";
    }

    // API 追踪类
    if (/api|接口|请求|request|response|route|路由/i.test(question)) {
      return "trace_api";
    }

    // 流程追踪类
    if (/流程|调用链|链路|flow|trace|追踪|入口/i.test(question)) {
      return "trace_flow";
    }

    // 架构理解类
    if (/架构|结构|模块|分层|architecture|structure|module/i.test(question)) {
      return "architecture";
    }

    // 项目概览类
    if (/概览|整体|简介|overview|summary|总结/i.test(question)) {
      return "overview";
    }

    // 调试类
    if (/报错|错误|bug|问题|error|debug|调试|排查/i.test(question)) {
      return "debug";
    }

    return "overview";  // 默认需要分析
  }

  private getSystemPrompt(): string {
    return `你是严谨的 Workflow Planner，负责根据用户问题选择合适的分析技能。

核心原则：
1. 只能从给定的 skill 列表中选择，不能发明新 skill
2. 不要补充 dependsOn，系统会自动补全依赖
3. 优先选择高价值、低成本的 skill
4. 如果问题简单或无需代码分析，返回 answer_directly

选择策略：
- 项目概览类问题 → project_overview, structure_summary
- 架构理解类问题 → project_overview, architecture_summary, structure_summary
- API 追踪类问题 → api_surface_summary, frontend_api_trace, backend_route_trace
- 流程追踪类问题 → project_overview, structure_summary, frontend_api_trace, backend_route_trace, business_flow_summary

输出格式：严格的 JSON，不要包含其他内容。`;
  }

  private buildEnhancedPrompt(
    params: {
      question: string;
      skills: SkillMetadata[];
      repoSummary?: string;
    },
    options: PlannerOptions,
    questionType: QuestionType,
  ): string {
    // 过滤出适合当前问题类型的 skill
    const relevantSkills = params.skills.filter(skill => {
      if (!skill.suitableFor || skill.suitableFor.length === 0) {
        return true;  // 没有限制的 skill 都可用
      }
      return skill.suitableFor.some(s =>
        s === "all_questions" ||
        s === questionType ||
        s === "initial_analysis"
      );
    });

    const skillList = relevantSkills.map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      useCases: skill.useCases,
      cost: skill.cost,
      useWhen: skill.useWhen,
      avoidWhen: skill.avoidWhen,
    }));

    return `
用户问题：
"${params.question}"

问题类型分析：${questionType}

仓库摘要：
${params.repoSummary || "暂无仓库摘要信息"}

可用技能列表：
${JSON.stringify(skillList, null, 2)}

约束条件：
- 最多选择 ${options.maxSkills} 个技能
- 高成本(high)技能最多选择 ${options.maxHighCostSkills} 个
- 当前预算限制：${options.budgetLimit}

请分析用户问题并选择合适的技能组合。

返回 JSON 格式：
{
  "mode": "answer_directly" | "run_workflow",
  "questionType": "${questionType}",
  "goal": "一句话说明分析目标",
  "skillIds": ["skill_id_1", "skill_id_2"],
  "reason": "解释为什么选择这些技能",
  "budgetConcern": "预算相关说明（如有）"
}
`.trim();
  }

  private normalizeDecision(
    raw: any,
    skills: SkillMetadata[],
    options: PlannerOptions,
  ): PlannerDecision {
    const validSkillIds = new Set(skills.map((skill) => skill.id));

    // 过滤有效的 skill id
    let selectedSkillIds = Array.isArray(raw?.skillIds)
      ? raw.skillIds.filter((id: string) => validSkillIds.has(id))
      : [];

    // 按成本排序，优先选择低成本的
    const skillsByCost = selectedSkillIds.sort((a: string, b: string) => {
      const skillA = skills.find((s: SkillMetadata) => s.id === a);
      const skillB = skills.find((s: SkillMetadata) => s.id === b);
      const costOrder = { low: 0, medium: 1, high: 2 };
      return (costOrder[skillA?.cost || "medium"]) - (costOrder[skillB?.cost || "medium"]);
    });

    // 应用预算限制
    selectedSkillIds = this.applyBudgetLimit(skillsByCost, skills, options);

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

  /**
   * 应用预算限制，裁剪 skill 列表
   */
  private applyBudgetLimit(
    skillIds: string[],
    skills: SkillMetadata[],
    options: PlannerOptions,
  ): string[] {
    const result: string[] = [];
    let highCostCount = 0;

    for (const skillId of skillIds) {
      const skill = skills.find(s => s.id === skillId);
      if (!skill) continue;

      // 检查总数限制
      if (result.length >= (options.maxSkills || 5)) {
        break;
      }

      // 检查高成本限制
      if (skill.cost === "high") {
        if (highCostCount >= (options.maxHighCostSkills || 2)) {
          continue;  // 跳过这个高成本 skill
        }
        highCostCount++;
      }

      result.push(skillId);
    }

    return result;
  }

  /**
   * 获取推荐的 skill 组合（无需 LLM）
   */
  getRecommendedSkills(questionType: QuestionType): string[] {
    const recommendations: Record<QuestionType, string[]> = {
      overview: ["project_overview", "structure_summary", "architecture_summary"],
      architecture: ["project_overview", "structure_summary", "architecture_summary"],
      trace_flow: ["project_overview", "structure_summary", "frontend_api_trace", "backend_route_trace", "business_flow_summary"],
      trace_api: ["api_surface_summary", "frontend_api_trace", "backend_route_trace"],
      debug: ["project_overview", "structure_summary", "architecture_summary"],
      feature_request: ["project_overview", "structure_summary", "architecture_summary", "dev_guide"],
      simple_qa: [],
      chitchat: [],
    };
    return recommendations[questionType] || [];
  }
}
