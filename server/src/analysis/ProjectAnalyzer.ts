import { Repo } from "../models/repo.model";
import { CodebaseMemory } from "../models/codebaseMemory.model";
import { DeepSeekClient } from "../llm/DeepSeekClients";
import { CodeChunker } from "../rag/CodeChunker";
import { VectorStore } from "../rag/VectorStore";
import fs from 'fs/promises'
import path from "path";

export class ProjectAnalyzer{
    private llmClient: DeepSeekClient;
    private codeChunker: CodeChunker;
    private vectorStore: VectorStore;
    
    constructor(){
        this.llmClient=new DeepSeekClient(process.env.DEEPSEEK_API_KEY!)
        this.codeChunker = new CodeChunker();
        this.vectorStore = new VectorStore();
    }
    private async parsePackageJson(repoPath:string){
        const files=await fs.readdir(repoPath);
        const packageJsonFile=files.find(file=>file==='package.json');
        if(!packageJsonFile){
            throw new Error("未找到package.json");
        }
        const packageJson=await fs.readFile(path.join(repoPath,packageJsonFile),'utf-8');
        return JSON.parse(packageJson);
    }
    private async analyzeStats(repoPath:string){
        //统计文件数 行数 语言分布
        const files=await fs.readdir(repoPath, { recursive: true, withFileTypes: true });
        const codeFiles = files.filter(f => 
            f.isFile() && 
            !f.parentPath.includes('node_modules') && 
            !f.parentPath.includes('.git') &&
            !f.parentPath.includes('dist')
        );
        
        const totalFiles=codeFiles.length;
        const languages:Record<string,number>={};
        let totalLines=0;
        
        for(const file of codeFiles){
            try {
                const filePath = path.join(file.parentPath, file.name);
                const content=await fs.readFile(filePath,'utf-8');
                const lines=content.split('\n').length;
                totalLines+=lines;
                const ext=path.extname(file.name);
                if (ext) {
                    languages[ext]=(languages[ext]||0)+lines;
                }
            } catch {
                // 跳过无法读取的文件
            }
        }
        return{
            totalFiles,
            totalLines,
            languages
        }
    }
    private async generateSummary(packageJson:any,stats:any){
        // 构建 prompt
        const techStack = [
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {}).filter(d => 
                ['react', 'vue', 'angular', 'express', 'fastify', 'typescript'].includes(d)
            )
        ].slice(0, 10);

        const languageList = Object.entries(stats.languages)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 5)
            .map(([ext, lines]) => `${ext}: ${lines} 行`)
            .join(', ');

        // 如果没有 API Key，直接返回默认值
        if (!process.env.DEEPSEEK_API_KEY) {
            console.log('⚠️  未配置 DEEPSEEK_API_KEY，使用默认摘要');
            return {
                description: packageJson.description || `${packageJson.name} 项目`,
                type: this.guessProjectType(packageJson),
                techStack: techStack.slice(0, 5),
                architecture: `项目包含 ${stats.totalFiles} 个文件，共 ${stats.totalLines} 行代码。主要使用 ${languageList}。`
            };
        }

        const prompt = `
分析以下项目信息，生成项目概览：

项目名称：${packageJson.name || '未知'}
技术栈：${techStack.join(', ')}
代码统计：${stats.totalFiles} 个文件，${stats.totalLines} 行代码
语言分布：${languageList}

请以 JSON 格式返回：
{
  "description": "项目描述（1-2句话）",
  "type": "Web应用 或 库 或 CLI工具",
  "techStack": ["主要技术栈，最多5个"],
  "architecture": "架构摘要（3-5句话，描述项目结构和主要模块）"
}

只返回 JSON，不要其他内容。
`;

        try {
            const response = await this.llmClient.chat([
                { role: 'system', content: '你是代码架构分析专家，擅长快速理解项目结构。' },
                { role: 'user', content: prompt }
            ]);

            const result = JSON.parse(response.content || '{}');
            return result;
        } catch (error) {
            // LLM 调用失败，使用默认值
            console.log('⚠️  LLM 调用失败，使用默认摘要');
            return {
                description: packageJson.description || `${packageJson.name} 项目`,
                type: this.guessProjectType(packageJson),
                techStack: techStack.slice(0, 5),
                architecture: `项目包含 ${stats.totalFiles} 个文件，共 ${stats.totalLines} 行代码。主要使用 ${languageList}。`
            };
        }
    }

    private guessProjectType(packageJson: any): string {
        const deps = Object.keys(packageJson.dependencies || {});
        if (deps.includes('react') || deps.includes('vue') || deps.includes('angular')) {
            return 'Web应用';
        }
        if (deps.includes('express') || deps.includes('fastify') || deps.includes('koa')) {
            return 'Web应用';
        }
        if (packageJson.bin) {
            return 'CLI工具';
        }
        return '库';
    }
    async analyze(repoId:string){
        const repo=await Repo.findOne({repoId});
        if(!repo){
            throw new Error("仓库不存在");
        }
        
        // 解析 package.json
        const packageJson=await this.parsePackageJson(repo.localPath);
        
        // 统计代码
        const stats=await this.analyzeStats(repo.localPath);
        
        // 生成摘要
        const summary=await this.generateSummary(packageJson, stats);
        
        // 格式化外部依赖
        const externalDeps = Object.entries(packageJson.dependencies || {}).map(([name, version]) => ({
            name,
            version: version as string,
            description: ''
        }));
        
        // 保存到数据库
        const memory = new CodebaseMemory({
            repoId,
            overview: {
                name: packageJson.name || repo.name,
                description: summary.description,
                techStack: summary.techStack,
                type: summary.type
            },
            architectureSummary: summary.architecture,
            modules: [],  // MVP 版本暂时为空
            dependencies: {
                external: externalDeps,
                internal: []  // MVP 版本暂时为空
            },
            stats,
            keyFiles: [],  // MVP 版本暂时为空
            issues: []     // MVP 版本暂时为空
        });
        
        await memory.save();
        console.log(`✅ 项目分析完成：${repo.name}`);
        
        // RAG 索引
        console.log('\n🔍 开始建立 RAG 向量索引...');
        try {
            // 1. 代码分块
            console.log('📦 代码分块中...');
            const chunks = await this.codeChunker.chunkRepo(repoId);
            
            // 2. 存入向量数据库
            console.log('💾 存入向量数据库...');
            await this.vectorStore.addChunks(chunks);
            
            console.log('✅ RAG 索引建立完成！');
        } catch (error: any) {
            console.error('⚠️  RAG 索引失败，但不影响项目分析:', error.message);
        }
        
        return memory;
    }
}