import mongoose, { Schema, Document } from "mongoose";

export interface IRepo extends Document {
  repoId: string;
  url: string;
  name: string;
  status: "cloning" | "ready" | "indexing" | "error";
  language?: string;
  fileCount: number;
  localPath: string;
  createdAt: Date;
  indexedAt?: Date;
  error?: string;
}

const RepoSchema = new Schema<IRepo>({
  repoId: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ["cloning", "ready", "indexing", "error"], default: "cloning" },
  language: String,
  fileCount: { type: Number, default: 0 },
  localPath: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  indexedAt: Date,
  error: String,
});

export const Repo = mongoose.model<IRepo>('Repo', RepoSchema);