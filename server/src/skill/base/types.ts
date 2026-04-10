export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  dependsOn: string[]; //依赖前置的Skill ID
  outputSchema: Record<string, any>; //输出JSON Schema
}
//Skill输入
export interface SkillInput {
  repoId: string;
  repoPath: string;
}
export interface SkillOutput {
  skillId: string;
  success: boolean;
  data: Record<string, any>; //结构化输出
  markdown: string;
  duration: number;
  error?: string;
}
export interface SkillProgressEvent {
  type: "tool_call" | "tool_result" | "thinking" | "validating";
  content: string;
  toolName?: string;
  toolInput?: Record<string, any>;
}
