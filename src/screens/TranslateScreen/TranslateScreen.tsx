import React, {useState, useEffect, useContext} from 'react';
import {View, ScrollView, TouchableOpacity, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Text, Button, Card, ActivityIndicator, Icon} from 'react-native-paper';
import * as DocumentPicker from 'react-native-document-picker';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';

import {
  translateManager,
  TranslationProgress,
  TranslationStatus,
  TranslationTaskState,
} from '../../utils';

import {t} from '../../locales';
import {L10nContext} from '../../utils';
import {modelStore} from '../../store';

const TARGET_LANGUAGES = [
  {value: 'Chinese', label: '中文'},
  {value: 'English', label: 'English'},
  {value: 'Japanese', label: '日本語'},
  {value: 'Korean', label: '한국어'},
  {value: 'Spanish', label: 'Español'},
  {value: 'French', label: 'Français'},
  {value: 'German', label: 'Deutsch'},
];

export const TranslateScreen: React.FC = () => {
  const l10n = useContext(L10nContext);
  const theme = useTheme();
  const styles = createStyles(theme);

  const [sourceFilePath, setSourceFilePath] = useState<string>('');
  const [outputFilePath, setOutputFilePath] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('Chinese');
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [currentChunkProgress, setCurrentChunkProgress] = useState(0);
  const [translatedText, setTranslatedText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [savedTasks, setSavedTasks] = useState<TranslationTaskState[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSavedTasks();
  }, []);

  const loadSavedTasks = async () => {
    const tasks = await translateManager.listSavedTasks();
    setSavedTasks(tasks);
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.text],
        allowMultiSelection: false,
      });

      const file = result[0];
      if (file) {
        setSourceFilePath(file.uri);
        // Generate output file path
        const dir = RNFS.DocumentDirectoryPath;
        const fileName = `translated_${Date.now()}_${file.name}`;
        setOutputFilePath(`${dir}/${fileName}`);
        setErrorMessage('');
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled
      } else {
        setErrorMessage(
          t('translate.error.file_pick') || 'Failed to pick file',
        );
      }
    }
  };

  const handleProgress = (progress: TranslationProgress) => {
    setStatus(progress.status);
    setCurrentChunk(progress.currentChunk);
    setTotalChunks(progress.totalChunks);
    setCurrentChunkProgress(progress.currentChunkProgress);
    setTranslatedText(progress.translatedText);

    if (progress.error) {
      setErrorMessage(progress.error);
    }
  };

  const handleStartTranslation = async () => {
    if (!sourceFilePath) {
      setErrorMessage(
        t('translate.error.select_file') || 'Please select a file',
      );
      return;
    }

    if (!modelStore.engine) {
      setErrorMessage(t('translate.error.no_model') || 'No model loaded');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    translateManager.setProgressCallback(handleProgress);

    try {
      await translateManager.translateFile(
        sourceFilePath,
        outputFilePath,
        targetLanguage,
      );
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
      translateManager.clearProgressCallback();
      await loadSavedTasks();
    }
  };

  const handlePauseTranslation = () => {
    translateManager.pauseTranslation();
  };

  const handleResumeTranslation = async () => {
    const taskId = translateManager.getCurrentTaskId();
    if (taskId) {
      setIsLoading(true);
      setErrorMessage('');

      translateManager.setProgressCallback(handleProgress);

      try {
        await translateManager.resumeTranslation(taskId, outputFilePath);
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setIsLoading(false);
        translateManager.clearProgressCallback();
        await loadSavedTasks();
      }
    }
  };

  const handleResumeSavedTask = async (task: TranslationTaskState) => {
    setSourceFilePath(task.sourceFilePath);
    setOutputFilePath(task.outputFilePath);
    setTargetLanguage(task.targetLanguage);
    setIsLoading(true);
    setErrorMessage('');

    translateManager.setProgressCallback(handleProgress);

    try {
      await translateManager.resumeTranslation(
        task.taskId,
        task.outputFilePath,
      );
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
      translateManager.clearProgressCallback();
      await loadSavedTasks();
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return t('translate.status.idle') || 'Ready';
      case 'translating':
        return t('translate.status.translating') || 'Translating...';
      case 'paused':
        return t('translate.status.paused') || 'Paused';
      case 'completed':
        return t('translate.status.completed') || 'Completed';
      case 'error':
        return t('translate.status.error') || 'Error';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return styles.statusSuccess;
      case 'error':
        return styles.statusError;
      case 'paused':
        return styles.statusPaused;
      default:
        return {};
    }
  };

  const getProgressPercentage = () => {
    if (totalChunks === 0) return 0;
    const chunkProgress = ((currentChunk - 1) / totalChunks) * 100;
    const currentProgress = (currentChunkProgress / 100) * (100 / totalChunks);
    return chunkProgress + currentProgress;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('translate.title') || 'Translate TXT File'}
          </Text>
          <Text style={styles.subtitle}>
            {t('translate.description') ||
              'Select a TXT file to translate. Supports pause/resume functionality.'}
          </Text>
        </View>

        {/* File Selection */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('translate.select_file') || 'Select TXT File'}
          </Text>
          <TouchableOpacity
            style={styles.fileInputContainer}
            onPress={handleFilePick}
            disabled={status === 'translating'}>
            <Icon source="file-text" size={48} style={styles.fileInputIcon} />
            <Text style={styles.fileInputText}>
              {sourceFilePath
                ? t('translate.file_selected') || 'File selected'
                : t('translate.tap_to_select') || 'Tap to select a TXT file'}
            </Text>
            {sourceFilePath && (
              <Text style={styles.filePathText}>{sourceFilePath}</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Target Language */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('translate.target_language') || 'Target Language'}
          </Text>
          <View style={styles.dropdownContainer}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}>
              {TARGET_LANGUAGES.map(lang => (
                <Button
                  key={lang.value}
                  mode={
                    targetLanguage === lang.value ? 'contained' : 'outlined'
                  }
                  onPress={() => setTargetLanguage(lang.value)}
                  disabled={status === 'translating'}>
                  {lang.label}
                </Button>
              ))}
            </View>
          </View>
        </Card>

        {/* Progress Display */}
        {(status === 'translating' || status === 'paused') && (
          <Card style={styles.card}>
            <Text style={[styles.statusText, getStatusColor()]}>
              {getStatusText()}
            </Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {width: `${getProgressPercentage()}%`},
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {t('translate.progress') || 'Progress'}: {currentChunk}/
                {totalChunks}({Math.round(getProgressPercentage())}%)
              </Text>
            </View>

            {/* Output Preview */}
            {translatedText && (
              <View style={styles.outputPreview}>
                <Text style={styles.previewTitle}>
                  {t('translate.preview') || 'Translation Preview'}
                </Text>
                <Text style={styles.previewText}>{translatedText}</Text>
              </View>
            )}
          </Card>
        )}

        {/* Completed Status */}
        {status === 'completed' && (
          <Card style={styles.card}>
            <Text style={[styles.statusText, styles.statusSuccess]}>
              {getStatusText()}
            </Text>
            <Text style={styles.progressText}>
              {t('translate.completed_message') ||
                `Translation saved to:\n${outputFilePath}`}
            </Text>
            {translatedText && (
              <View style={styles.outputPreview}>
                <Text style={styles.previewTitle}>
                  {t('translate.result') || 'Translation Result'}
                </Text>
                <Text style={styles.previewText}>{translatedText}</Text>
              </View>
            )}
          </Card>
        )}

        {/* Error Message */}
        {errorMessage && (
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {status === 'idle' && (
            <Button
              style={styles.button}
              mode="contained"
              onPress={handleStartTranslation}
              disabled={isLoading || !sourceFilePath}>
              {isLoading ? (
                <ActivityIndicator size="small" />
              ) : (
                t('translate.start') || 'Start Translation'
              )}
            </Button>
          )}

          {status === 'translating' && (
            <Button
              style={styles.button}
              mode="outlined"
              onPress={handlePauseTranslation}>
              {t('translate.pause') || 'Pause'}
            </Button>
          )}

          {status === 'paused' && (
            <Button
              style={styles.button}
              mode="contained"
              onPress={handleResumeTranslation}>
              {t('translate.resume') || 'Resume'}
            </Button>
          )}

          {(status === 'completed' || status === 'error') && (
            <Button
              style={styles.button}
              mode="contained"
              onPress={() => {
                setStatus('idle');
                setSourceFilePath('');
                setOutputFilePath('');
                setTranslatedText('');
                setErrorMessage('');
              }}>
              {t('translate.new') || 'New Translation'}
            </Button>
          )}
        </View>

        {/* Saved Tasks */}
        {savedTasks.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>
              {t('translate.saved_tasks') || 'Saved Tasks'}
            </Text>
            <View style={styles.savedTasksContainer}>
              {savedTasks.map(task => (
                <TouchableOpacity
                  key={task.taskId}
                  style={styles.savedTaskItem}
                  onPress={() => handleResumeSavedTask(task)}>
                  <View style={styles.savedTaskInfo}>
                    <Text style={styles.savedTaskName}>
                      {task.sourceFilePath.split('/').pop()}
                    </Text>
                    <Text style={styles.savedTaskProgress}>
                      {t('translate.progress') || 'Progress'}:{' '}
                      {task.currentChunkIndex}/{task.chunks.length}
                    </Text>
                  </View>
                  <Button
                    style={styles.savedTaskButton}
                    mode="text"
                    onPress={() => handleResumeSavedTask(task)}>
                    {t('translate.resume') || 'Resume'}
                  </Button>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default TranslateScreen;
