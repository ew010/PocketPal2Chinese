import * as RNFS from '@dr.pogodin/react-native-fs';
import {v4 as uuidv4} from 'uuid';
import 'react-native-get-random-values';

import {modelStore} from '../store';
import {toApiCompletionParams} from './completionTypes';

/**
 * 翻译任务状态
 */
export type TranslationStatus =
  | 'idle'
  | 'translating'
  | 'paused'
  | 'completed'
  | 'error';

/**
 * 翻译块信息
 */
export interface TranslationChunk {
  id: string;
  text: string;
  translatedText: string;
  completed: boolean;
}

/**
 * 翻译进度回调
 */
export interface TranslationProgressCallback {
  (progress: TranslationProgress): void;
}

/**
 * 翻译进度信息
 */
export interface TranslationProgress {
  status: TranslationStatus;
  currentChunk: number;
  totalChunks: number;
  currentChunkProgress: number; // 0-100
  translatedText: string;
  error?: string;
}

/**
 * 翻译任务状态保存格式
 */
export interface TranslationTaskState {
  taskId: string;
  sourceFilePath: string;
  outputFilePath: string;
  targetLanguage: string;
  chunks: TranslationChunk[];
  currentChunkIndex: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 翻译工具类
 * 支持txt文件翻译，支持暂停恢复功能
 */
export class TranslateManager {
  private static INSTANCE: TranslateManager | null = null;

  private isPaused = false;
  private isCancelled = false;
  private currentTaskId: string | null = null;
  private progressCallback: TranslationProgressCallback | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): TranslateManager {
    if (!TranslateManager.INSTANCE) {
      TranslateManager.INSTANCE = new TranslateManager();
    }
    return TranslateManager.INSTANCE;
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: TranslationProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * 清除进度回调
   */
  clearProgressCallback(): void {
    this.progressCallback = null;
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(progress: TranslationProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * 读取txt文件内容
   */
  async readTxtFile(filePath: string): Promise<string> {
    try {
      return await RNFS.readFile(filePath, 'utf8');
    } catch (error) {
      console.error('Error reading txt file:', error);
      throw new Error('Failed to read txt file');
    }
  }

  /**
   * 将文本分块
   * @param text 原始文本
   * @param chunkSize 每块的最大字符数
   */
  chunkText(text: string, chunkSize: number = 1000): TranslationChunk[] {
    const chunks: TranslationChunk[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;

      // 尝试在句子边界处分割
      if (end < text.length) {
        const sentenceEnds = ['.', '!', '?', '\n', '\r'];
        let foundBreak = false;

        // 向前查找最近的句子结束符
        for (let i = end; i >= start; i--) {
          if (sentenceEnds.includes(text[i])) {
            end = i + 1;
            foundBreak = true;
            break;
          }
        }

        // 如果没找到句子结束符，就按chunkSize分割
        if (!foundBreak) {
          end = start + chunkSize;
        }
      } else {
        end = text.length;
      }

      chunks.push({
        id: uuidv4(),
        text: text.substring(start, end),
        translatedText: '',
        completed: false,
      });

      start = end;
    }

    return chunks;
  }

  /**
   * 生成翻译任务ID
   */
  private generateTaskId(): string {
    return `translate_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }

  /**
   * 获取任务状态文件路径
   */
  private getTaskStatePath(taskId: string): string {
    return `${RNFS.DocumentDirectoryPath}/translate/tasks/${taskId}.json`;
  }

  /**
   * 保存翻译任务状态
   */
  async saveTaskState(taskState: TranslationTaskState): Promise<void> {
    const filePath = this.getTaskStatePath(taskState.taskId);
    const dirPath = `${RNFS.DocumentDirectoryPath}/translate/tasks`;

    try {
      // 确保目录存在
      if (!(await RNFS.exists(dirPath))) {
        await RNFS.mkdir(dirPath, {NSURLIsExcludedFromBackupKey: true});
      }

      const data = JSON.stringify(taskState, null, 2);
      await RNFS.writeFile(filePath, data, 'utf8');
    } catch (error) {
      console.error('Error saving task state:', error);
      throw new Error('Failed to save task state');
    }
  }

  /**
   * 加载翻译任务状态
   */
  async loadTaskState(taskId: string): Promise<TranslationTaskState | null> {
    const filePath = this.getTaskStatePath(taskId);

    try {
      if (!(await RNFS.exists(filePath))) {
        return null;
      }

      const data = await RNFS.readFile(filePath, 'utf8');
      return JSON.parse(data) as TranslationTaskState;
    } catch (error) {
      console.error('Error loading task state:', error);
      return null;
    }
  }

  /**
   * 删除任务状态文件
   */
  async deleteTaskState(taskId: string): Promise<void> {
    const filePath = this.getTaskStatePath(taskId);

    try {
      if (await RNFS.exists(filePath)) {
        await RNFS.unlink(filePath);
      }
    } catch (error) {
      console.error('Error deleting task state:', error);
    }
  }

  /**
   * 保存已翻译的文本到输出文件
   */
  async saveTranslatedText(
    outputFilePath: string,
    text: string,
  ): Promise<void> {
    try {
      await RNFS.writeFile(outputFilePath, text, 'utf8');
    } catch (error) {
      console.error('Error saving translated text:', error);
      throw new Error('Failed to save translated text');
    }
  }

  /**
   * 生成翻译提示词
   */
  private buildTranslationPrompt(text: string, targetLanguage: string): string {
    return `Translate the following text to ${targetLanguage}. Keep the original formatting and structure.

${text}`;
  }

  /**
   * 调用AI模型进行翻译
   */
  private async translateChunk(
    text: string,
    targetLanguage: string,
  ): Promise<string> {
    const engine = modelStore.engine;
    if (!engine) {
      throw new Error('No model loaded');
    }

    const prompt = this.buildTranslationPrompt(text, targetLanguage);

    const completionParams = toApiCompletionParams({
      prompt,
      temperature: 0.3,
      n_predict: 2000,
      stop: ['\n\n'],
    });

    const result = await engine.completion(completionParams);
    return result.text.trim();
  }

  /**
   * 翻译txt文件（主入口）
   * @param sourceFilePath 源文件路径
   * @param outputFilePath 输出文件路径
   * @param targetLanguage 目标语言
   * @param resumeTaskId 可选，要恢复的任务ID
   */
  async translateFile(
    sourceFilePath: string,
    outputFilePath: string,
    targetLanguage: string = 'Chinese',
    resumeTaskId?: string,
  ): Promise<void> {
    // 重置状态
    this.isPaused = false;
    this.isCancelled = false;

    let taskState: TranslationTaskState;

    if (resumeTaskId) {
      // 尝试恢复之前的任务
      const savedState = await this.loadTaskState(resumeTaskId);
      if (!savedState) {
        throw new Error('Task not found');
      }
      taskState = savedState;
      this.currentTaskId = resumeTaskId;
    } else {
      // 创建新任务
      const text = await this.readTxtFile(sourceFilePath);
      const chunks = this.chunkText(text);

      taskState = {
        taskId: this.generateTaskId(),
        sourceFilePath,
        outputFilePath,
        targetLanguage,
        chunks,
        currentChunkIndex: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.currentTaskId = taskState.taskId;

      // 保存初始状态
      await this.saveTaskState(taskState);
    }

    // 发送初始进度
    this.notifyProgress({
      status: 'translating',
      currentChunk: taskState.currentChunkIndex + 1,
      totalChunks: taskState.chunks.length,
      currentChunkProgress: 0,
      translatedText: this.getTranslatedText(taskState.chunks),
    });

    // 开始翻译
    for (
      let i = taskState.currentChunkIndex;
      i < taskState.chunks.length;
      i++
    ) {
      // 检查是否暂停或取消
      if (this.isPaused) {
        this.notifyProgress({
          status: 'paused',
          currentChunk: i,
          totalChunks: taskState.chunks.length,
          currentChunkProgress: 0,
          translatedText: this.getTranslatedText(taskState.chunks),
        });
        return;
      }

      if (this.isCancelled) {
        // 删除任务状态
        await this.deleteTaskState(taskState.taskId);
        this.notifyProgress({
          status: 'error',
          currentChunk: i,
          totalChunks: taskState.chunks.length,
          currentChunkProgress: 0,
          translatedText: this.getTranslatedText(taskState.chunks),
          error: 'Translation cancelled',
        });
        return;
      }

      const chunk = taskState.chunks[i];

      try {
        // 发送开始翻译当前块的进度
        this.notifyProgress({
          status: 'translating',
          currentChunk: i + 1,
          totalChunks: taskState.chunks.length,
          currentChunkProgress: 0,
          translatedText: this.getTranslatedText(taskState.chunks),
        });

        // 翻译当前块
        const translatedText = await this.translateChunk(
          chunk.text,
          targetLanguage,
        );

        // 更新块状态
        chunk.translatedText = translatedText;
        chunk.completed = true;
        taskState.currentChunkIndex = i + 1;
        taskState.updatedAt = Date.now();

        // 保存状态
        await this.saveTaskState(taskState);

        // 保存已翻译内容到输出文件
        const fullTranslatedText = this.getTranslatedText(taskState.chunks);
        await this.saveTranslatedText(outputFilePath, fullTranslatedText);

        // 发送进度更新
        this.notifyProgress({
          status: 'translating',
          currentChunk: i + 1,
          totalChunks: taskState.chunks.length,
          currentChunkProgress: 100,
          translatedText: fullTranslatedText,
        });
      } catch (error) {
        console.error('Error translating chunk:', error);

        // 保存当前状态以便恢复
        await this.saveTaskState(taskState);

        this.notifyProgress({
          status: 'error',
          currentChunk: i + 1,
          totalChunks: taskState.chunks.length,
          currentChunkProgress: 0,
          translatedText: this.getTranslatedText(taskState.chunks),
          error: (error as Error).message,
        });

        throw error;
      }
    }

    // 翻译完成
    await this.deleteTaskState(taskState.taskId);

    this.notifyProgress({
      status: 'completed',
      currentChunk: taskState.chunks.length,
      totalChunks: taskState.chunks.length,
      currentChunkProgress: 100,
      translatedText: this.getTranslatedText(taskState.chunks),
    });
  }

  /**
   * 获取已翻译的完整文本
   */
  private getTranslatedText(chunks: TranslationChunk[]): string {
    return chunks
      .filter(chunk => chunk.completed && chunk.translatedText)
      .map(chunk => chunk.translatedText)
      .join('\n\n');
  }

  /**
   * 暂停翻译
   */
  pauseTranslation(): void {
    this.isPaused = true;
  }

  /**
   * 取消翻译
   */
  cancelTranslation(): void {
    this.isCancelled = true;
    // 停止AI模型的当前完成
    if (modelStore.engine) {
      modelStore.engine.stopCompletion().catch(console.error);
    }
  }

  /**
   * 恢复翻译
   * @param taskId 要恢复的任务ID
   * @param outputFilePath 新的输出文件路径（可选）
   */
  async resumeTranslation(
    taskId: string,
    outputFilePath?: string,
  ): Promise<void> {
    const taskState = await this.loadTaskState(taskId);
    if (!taskState) {
      throw new Error('Task not found');
    }

    this.isPaused = false;
    this.isCancelled = false;

    // 如果提供了新的输出路径，更新它
    if (outputFilePath) {
      taskState.outputFilePath = outputFilePath;
    }

    await this.translateFile(
      taskState.sourceFilePath,
      taskState.outputFilePath,
      taskState.targetLanguage,
      taskId,
    );
  }

  /**
   * 获取当前任务ID
   */
  getCurrentTaskId(): string | null {
    return this.currentTaskId;
  }

  /**
   * 检查是否正在翻译
   */
  isTranslating(): boolean {
    return !this.isPaused && !this.isCancelled && this.currentTaskId !== null;
  }

  /**
   * 检查是否已暂停
   */
  isTranslationPaused(): boolean {
    return this.isPaused;
  }

  /**
   * 列出所有已保存的任务
   */
  async listSavedTasks(): Promise<TranslationTaskState[]> {
    const dirPath = `${RNFS.DocumentDirectoryPath}/translate/tasks`;
    const tasks: TranslationTaskState[] = [];

    try {
      if (!(await RNFS.exists(dirPath))) {
        return tasks;
      }

      const files = await RNFS.readDir(dirPath);

      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.json')) {
          const taskId = file.name.replace('.json', '');
          const taskState = await this.loadTaskState(taskId);
          if (taskState) {
            tasks.push(taskState);
          }
        }
      }

      // 按更新时间排序（最新的在前）
      tasks.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('Error listing saved tasks:', error);
    }

    return tasks;
  }
}

// 创建单例导出
export const translateManager = TranslateManager.getInstance();
