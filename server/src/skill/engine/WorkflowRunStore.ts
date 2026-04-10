import { v4 as uuidv4 } from "uuid";
import { WorkflowRun } from "../../models/workflowRun.model";
import { WorkflowEvent, WorkflowResult } from "./WorkflowConfig";

// 负责把内存中的工作流事件同步到 WorkflowRun 文档，方便后续查询和续跑。
export class WorkflowRunStore {
  async create(workflowId: string, repoId: string, skillIds: string[]) {
    const initialSkillResults = Object.fromEntries(
      skillIds.map((skillId) => [skillId, { status: "pending" }]),
    );

    const run = await WorkflowRun.create({
      runId: uuidv4(),
      workflowId,
      repoId,
      status: "running",
      skillResults: initialSkillResults,
      startedAt: new Date(),
    });

    return run;
  }

  async applyEvent(runId: string, event: WorkflowEvent) {
    if (event.type === "skill_start" && event.skillId) {
      await WorkflowRun.updateOne(
        { runId },
        {
          $set: {
            [`skillResults.${event.skillId}.status`]: "running",
          },
        },
      );
      return;
    }

    if (event.type === "skill_complete" && event.skillId) {
      await WorkflowRun.updateOne(
        { runId },
        {
          $set: {
            [`skillResults.${event.skillId}.status`]: "completed",
            [`skillResults.${event.skillId}.data`]: event.data,
          },
        },
      );
      return;
    }

    if (event.type === "skill_error" && event.skillId) {
      await WorkflowRun.updateOne(
        { runId },
        {
          $set: {
            [`skillResults.${event.skillId}.status`]: "failed",
            [`skillResults.${event.skillId}.error`]: event.error,
          },
        },
      );
    }
  }

  async complete(runId: string, result: WorkflowResult) {
    await WorkflowRun.updateOne(
      { runId },
      {
        $set: {
          status: result.success ? "completed" : "failed",
          // 工作流结束时统一写入完整结果，补齐 markdown、duration 等字段。
          skillResults: Object.fromEntries(
            Object.entries(result.skillResults).map(([skillId, skillResult]) => [
              skillId,
              {
                status: skillResult.success ? "completed" : "failed",
                data: skillResult.data,
                markdown: skillResult.markdown,
                duration: skillResult.duration,
                error: skillResult.error,
              },
            ]),
          ),
          completedAt: new Date(),
          error: result.error,
        },
      },
    );
  }

  async fail(runId: string, error: string) {
    await WorkflowRun.updateOne(
      { runId },
      {
        $set: {
          status: "failed",
          error,
          completedAt: new Date(),
        },
      },
    );
  }
}
