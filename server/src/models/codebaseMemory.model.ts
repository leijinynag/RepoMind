import mongoose, { Schema, Document } from "mongoose";

export interface ICodebaseMemory extends Document {
  repoId: string;

  overview: {
    name: string;
    description: string;
    techStack: string[];
    type: string;
  };

  architectureSummary: string; //架构摘要（LLM生成）
  //模块列表
  modules: Array<{
    name: string;
    path: string;
    description: string;
    exports: string[];
  }>;
  //依赖关系
  dependencies: {
    external: Array<{
      name: string;
      version: string;
      description: string;
    }>;
    internal: Array<{
      from: string;
      to: string;
    }>;
  };
  //代码统计
  stats: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  };

  keyFiles: Array<{
    path: string;
    role: string;
    summary: string;
  }>;
  //发现的问题
  issues: Array<{
    type: string;
    severity: "high" | "medium" | "low";
    location: string;
    description: string;
    suggestion: string;
  }>;
  //元信息
  generatedAt: Date;
  version: number;
}

const CodebaseMemorySchema = new Schema<ICodebaseMemory>({
  repoId: { type: String, required: true, unique: true },

  overview: {
    name: { type: String, required: true },
    description: { type: String, required: true },
    techStack: [{ type: String }],
    type: { type: String, required: true },
  },

  architectureSummary: { type: String, required: true },

  modules: [
    {
      name: { type: String, required: true },
      path: { type: String, required: true },
      description: { type: String, required: true },
      exports: [{ type: String }],
    },
  ],

  dependencies: {
    external: [
      {
        name: { type: String, required: true },
        version: { type: String, required: true },
        description: { type: String },
      },
    ],
    internal: [
      {
        from: { type: String, required: true },
        to: { type: String, required: true },
      },
    ],
  },

  stats: {
    totalFiles: { type: Number, required: true },
    totalLines: { type: Number, required: true },
    languages: { type: Schema.Types.Mixed, required: true },
  },

  keyFiles: [
    {
      path: { type: String, required: true },
      role: { type: String, required: true },
      summary: { type: String, required: true },
    },
  ],

  issues: [
    {
      type: { type: String, required: true },
      severity: {
        type: String,
        enum: ["high", "medium", "low"],
        required: true,
      },
      location: { type: String, required: true },
      description: { type: String, required: true },
      suggestion: { type: String, required: true },
    },
  ],

  generatedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
});

export const CodebaseMemory = mongoose.model<ICodebaseMemory>(
  "CodebaseMemory",
  CodebaseMemorySchema,
);
