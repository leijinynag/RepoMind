import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { Repo } from '../models/repo.model';

export class RepoManager {
  private reposDir: string;

  constructor() {
    this.reposDir = path.resolve(process.cwd(), process.env.REPOS_DIR || '../repos');
  }

  async cloneRepo(url: string): Promise<string> {
    // 验证 GitHub URL
    if (!url.match(/^https:\/\/github\.com\/[\w-]+\/[\w-]+/)) {
      throw new Error('Invalid GitHub URL');
    }

    const repoId = uuidv4();
    const repoName = url.split('/').pop()?.replace('.git', '') || 'unknown';
    //转为本地路径
    const localPath = path.join(this.reposDir, repoId);

    // 创建 repo 记录
    const repo = new Repo({
      repoId,
      url,
      name: repoName,
      status: 'cloning',
      localPath,
    });
    await repo.save();

    try {
      // 确保目录存在
      await fs.mkdir(localPath, { recursive: true });

      // clone（shallow clone 节省时间和空间）
      const git = simpleGit();
      await git.clone(url, localPath, ['--depth', '1']);

      // 统计文件数
      const fileCount = await this.countFiles(localPath);

      // 更新状态
      repo.status = 'ready';
      repo.fileCount = fileCount;
      await repo.save();

      return repoId;
    } catch (error: any) {
      repo.status = 'error';
      repo.error = error.message;
      await repo.save();
      throw error;
    }
  }

  private async countFiles(dir: string): Promise<number> {
    let count = 0;
    try {
      const files = await fs.readdir(dir, { withFileTypes: true });

      for (const file of files) {
        if (file.name === '.git') continue;
        if (file.name.startsWith('.')) continue;

        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          count += await this.countFiles(fullPath);
        } else {
          count++;
        }
      }
    } catch (error) {
      // 忽略权限错误等
    }
    return count;
  }

  async getRepo(repoId: string) {
    return Repo.findOne({ repoId });
  }

  async listRepos() {
    return Repo.find().sort({ createdAt: -1 });
  }

  async deleteRepo(repoId: string) {
    const repo = await Repo.findOne({ repoId });
    if (!repo) throw new Error('Repo not found');

    // 删除本地文件
    await fs.rm(repo.localPath, { recursive: true, force: true });

    // 删除数据库记录
    await Repo.deleteOne({ repoId });
  }
}
