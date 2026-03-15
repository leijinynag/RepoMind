//工具执行的参数
export interface ToolParams {
  repoId: string;
  [key: string]: any; //其他参数
}

//工具定义
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}
//抽象基类
export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  //返回工具的JSON Schema(给LLM看)
  abstract getDefinition(): ToolDefinition;
  //执行工具
  abstract execute(params: ToolParams): Promise<string>;
}
