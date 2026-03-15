import {BaseTool,ToolParams} from './BaseTool'

export class ToolRegistry{
    private tools:Map<string,BaseTool> = new Map();
    //注册工具
    register(tool:BaseTool):void{
        this.tools.set(tool.name, tool);
    }
    //获取所有工具定义
    getAllDefinitions(){
        return Array.from(this.tools.values()).map(tool => tool.getDefinition());
    }
    //执行工具
    async execute(toolName:string,params:ToolParams):Promise<string>{
        const tool = this.tools.get(toolName);
        if(!tool){
            throw new Error(`Tool ${toolName} not found`)
        }
        return tool.execute(params)
    }
}