import { WorkflowConfig } from "../engine/WorkflowConfig";

export const projectReportWorkflow: WorkflowConfig = {
  id: "project_report",
  name: "项目分析报告",
  description: "面向仓库首轮分析的完整工作流，包含结构摘要、开发指南、测试分析和调用链追踪。",
  skills: [
    "project_overview",
    "architecture_summary",
    "structure_summary",
    "api_surface_summary",
    "frontend_api_trace",
    "backend_route_trace",
    "business_flow_summary",
    "dependencies_analysis",
    "code_metrics",
    "dev_guide",
    "key_files",
    "test_analysis",
  ],
};
