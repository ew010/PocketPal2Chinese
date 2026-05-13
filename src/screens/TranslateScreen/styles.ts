import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    container: {
      flex: 1,
      padding: 16,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.onSurface,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    card: {
      marginVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      padding: 16,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginBottom: 12,
    },
    fileInputContainer: {
      borderWidth: 2,
      borderColor: theme.colors.outline,
      borderStyle: 'dashed',
      borderRadius: 8,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
    },
    fileInputText: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
      fontSize: 14,
    },
    fileInputIcon: {
      color: theme.colors.secondary,
    },
    filePathText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
      fontStyle: 'italic',
    },
    dropdownContainer: {
      marginVertical: 8,
    },
    dropdown: {
      width: '100%',
    },
    languageButtonContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    button: {
      flex: 1,
      height: 52,
    },
    progressContainer: {
      marginVertical: 16,
    },
    progressBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceVariant,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: theme.colors.secondary,
      transitionProperty: 'width',
      transitionDuration: '200ms',
    },
    progressText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
      textAlign: 'center',
    },
    statusText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginBottom: 8,
    },
    statusSuccess: {
      color: theme.colors.success,
    },
    statusError: {
      color: theme.colors.error,
    },
    statusPaused: {
      color: theme.colors.warning,
    },
    savedTasksContainer: {
      marginTop: 16,
    },
    savedTaskItem: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    savedTaskInfo: {
      flex: 1,
    },
    savedTaskName: {
      fontSize: 14,
      color: theme.colors.onSurface,
      fontWeight: '500',
    },
    savedTaskProgress: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    savedTaskButton: {
      marginLeft: 12,
    },
    errorMessage: {
      color: theme.colors.error,
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },
    outputPreview: {
      marginTop: 16,
    },
    previewTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginBottom: 8,
    },
    previewText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
      maxHeight: 200,
      overflow: 'hidden',
    },
  });
