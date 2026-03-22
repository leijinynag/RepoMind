import { Router } from 'express';
import { RepoManager } from '../repo/RepoManager';
import { ProjectAnalyzer } from '../analysis/ProjectAnalyzer';
import { CodebaseMemory } from '../models/codebaseMemory.model';

const router = Router();
const repoManager = new RepoManager();
const projectAnalyzer = new ProjectAnalyzer();

// 加载 repo
router.post('/load', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const repoId = await repoManager.cloneRepo(url);
    const repo = await repoManager.getRepo(repoId);

    res.json({ repoId, repo });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取 repo 列表
router.get('/list', async (req, res) => {
  try {
    const repos = await repoManager.listRepos();
    res.json({ repos });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个 repo
router.get('/:repoId', async (req, res) => {
  try {
    const repo = await repoManager.getRepo(req.params.repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repo not found' });
    }
    res.json({ repo });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除 repo
router.delete('/:repoId', async (req, res) => {
  try {
    await repoManager.deleteRepo(req.params.repoId);
    res.json({ message: 'Repo deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 分析项目
router.post('/:repoId/analyze', async (req, res) => {
  try {
    const { repoId } = req.params;
    const memory = await projectAnalyzer.analyze(repoId);
    res.json({ message: '项目分析完成', memory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取项目分析结果
router.get('/:repoId/memory', async (req, res) => {
  try {
    const { repoId } = req.params;
    const memory = await CodebaseMemory.findOne({ repoId });
    if (!memory) {
      return res.status(404).json({ error: '未找到项目分析结果，请先执行分析' });
    }
    res.json({ memory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取仓库文件目录树
router.get('/:repoId/files', async (req, res) => {
  try {
    const { repoId } = req.params;
    const tree = await repoManager.getFileTree(repoId);
    res.json({ tree });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
