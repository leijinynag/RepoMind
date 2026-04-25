import mongoose, { Schema, Document } from "mongoose";

export interface ICodebaseMemory extends Document {
  repoId: string;

  overview: {
    name: string;
    description: string;
    techStack: {
      frontend: string[];
      backend: string[];
      database: string[];
      devTools: string[];
    };
    type: string;
  };

  // 架构摘要（兼容旧格式）
  architectureSummary: string;

  // 新增：结构化架构信息
  architecture?: {
    purpose?: string;
    useCases?: string[];
    targetUsers?: string[];
    pattern?: string;
    howItWorks?: string;
    quickStart?: string;
    warnings?: string[];
  };

  structureSummary?: {
    areas: Array<{ path: string; role: string }>;
    entrypoints: Array<{ path: string; reason: string }>;
    boundaries: Array<{ name?: string; type?: string; description?: string; location?: string }>;
    summary: string;
  };

  devGuide?: {
    startup: string;
    scripts: Array<{ name: string; command: string; description: string }>;
    envHints: string[];
    keyPaths: string[];
    pitfalls: string[];
  };

  modules: Array<{
    name: string;
    path: string;
    description: string;
    exports: string[];
  }>;

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

  stats: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  };

  keyFiles: Array<{
    path: string;
    reason: string;
    confidence: string;
  }>;

  issues: Array<{
    type: string;
    severity: "high" | "medium" | "low";
    location: string;
    description: string;
    suggestion: string;
  }>;

  generatedAt: Date;
  version: number;
}

const CodebaseMemorySchema = new Schema<ICodebaseMemory>({
  repoId: { type: String, required: true, unique: true },

  overview: {
    name: { type: String, required: true },
    description: { type: String, required: true },
    techStack: {
      frontend: [{ type: String }],
      backend: [{ type: String }],
      database: [{ type: String }],
      devTools: [{ type: String }],
    },
    type: { type: String, required: true },
  },

  architectureSummary: { type: String, required: true },

  // 新增：结构化架构信息
  architecture: {
    purpose: { type: String },
    useCases: [{ type: String }],
    targetUsers: [{ type: String }],
    pattern: { type: String },
    howItWorks: { type: String },
    quickStart: { type: String },
    warnings: [{ type: String }],
  },

  structureSummary: {
    areas: [{ path: String, role: String }],
    entrypoints: [{ path: String, reason: String }],
    boundaries: [{ name: String, type: String, description: String, location: String }],
    summary: String,
  },

  devGuide: {
    startup: String,
    scripts: [{ name: String, command: String, description: String }],
    envHints: [{ type: String }],
    keyPaths: [{ type: String }],
    pitfalls: [{ type: String }],
  },

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
      reason: { type: String, required: true },
      confidence: { type: String, required: true },
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
