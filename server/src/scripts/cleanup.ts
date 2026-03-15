import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { Repo } from '../models/repo.model';

dotenv.config();

async function cleanup() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ 已连接到 MongoDB');

    // 获取所有 repo
    const repos = await Repo.find();
    console.log(`📦 找到 ${repos.length} 个仓库`);

    // 删除所有本地文件和数据库记录
    for (const repo of repos) {
      console.log(`🗑️  删除: ${repo.name} (${repo.repoId})`);
      
      // 删除本地文件
      try {
        await fs.rm(repo.localPath, { recursive: true, force: true });
        console.log(`   ✅ 本地文件已删除`);
      } catch (error) {
        console.log(`   ⚠️  本地文件删除失败（可能已不存在）`);
      }

      // 删除数据库记录
      await Repo.deleteOne({ repoId: repo.repoId });
      console.log(`   ✅ 数据库记录已删除`);
    }

    console.log('\n🎉 清理完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 清理失败:', error);
    process.exit(1);
  }
}

cleanup();
