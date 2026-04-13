import { WorkflowConfig } from "../engine/WorkflowConfig";

export const flowTraceReportWorkflow: WorkflowConfig = {
  id: "flow_trace_report",
  name: "前后端链路追踪",
  description: "面向 API 调用链与业务流的深度工作流。",
  skills: [
    "project_overview",
    "structure_summary",
    "api_surface_summary",
    "frontend_api_trace",
    "backend_route_trace",
    "business_flow_summary",
  ],
};
