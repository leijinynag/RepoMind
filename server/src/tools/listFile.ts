import fs from 'fs/promises'
import path from 'path'
import {BaseTool,ToolParams,ToolDefinition} from './BaseTool'
import {Repo} from '../models/repo.model'
export class ListFilesTool extends BaseTool{
    name= 'list_files';
    description='列出仓库中指定目录下的文件和文件夹';
     getDefinition(): ToolDefinition {
         return {
            name:this.name,
            description:this.description,
            parameters:{
                type:'object',
                properties:{
                    dirPath:{
                        type:'string',
                        description:'目录路径相对路径，默认为根目录 "."'
                    },
                    repoId:{
                        type:'string',
                        description:'仓库ID'
                    }
                },
                required:['repoId']
            }
         }
     }
     async execute (params: ToolParams): Promise<string>{
        const repo = await Repo.findOne({ repoId: params.repoId });
        if (!repo) {
            return "错误：仓库不存在";
        }
        try {
            const dirPath = params.dirPath || '.';
            const fullPath = path.join(repo.localPath, dirPath);
            const files = await fs.readdir(fullPath, { withFileTypes: true });
            //格式化输出，区分文件和文件夹，过滤 .git
            const result = files
                .filter(f => f.name !== '.git')
                .map(f => f.isDirectory() ? `📁 ${f.name}/` : `📄 ${f.name}`)
                .join('\n');
            return result || '（空目录）';
        } catch (error: any) {
            return `错误：无法读取目录 ${params.dirPath || '.'} - ${error.message}`;
        }
     }
}