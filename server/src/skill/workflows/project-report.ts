import { WorkflowConfig } from "../engine/WorkflowConfig";

export const projectReportWorkflow: WorkflowConfig = {
  id: "project_report",
  name: "项目分析报告",
  description: "面向仓库首轮分析的完整工作流，包含结构摘要、开发指南和测试分析。",
  skills: [
    "project_overview",
    "architecture_summary",
    "structure_summary",
    "dependencies_analysis",
    "code_metrics",
    "dev_guide",
    "key_files",
    "test_analysis",
  ],
};
