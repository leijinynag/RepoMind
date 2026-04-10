import { WorkflowConfig } from "../engine/WorkflowConfig";

export const projectReportWorkflow: WorkflowConfig = {
  id: "project_report",
  name: "项目分析报告",
  description: "面向仓库首轮分析的最小工作流。",
  skills: ["project_overview", "architecture_summary", "key_files"],
};
