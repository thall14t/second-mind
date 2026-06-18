import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { CaptureJob, InboxCapture } from '../types';
import { formatCardDate } from '../utils/antinet';
import {
  getInboxCaptureDisplayPreview,
  getInboxCaptureDisplayStatus,
  getInboxCaptureDisplayTitle,
  getInboxCaptureStatusLabel,
  inboxCaptureIsReadyToFile,
} from '../utils/captureJobs';

interface InboxScreenProps {
  darkMode: boolean;
  captures: InboxCapture[];
  captureJobsByCaptureId: Record<string, CaptureJob>;
  onQuickCapture: () => void;
  onFileCapture: (capture: InboxCapture) => void;
  onFileCaptureWithAi: (capture: InboxCapture) => void;
  onTurnIntoTodos: (capture: InboxCapture) => void;
  onDeleteCapture: (capture: InboxCapture) => void;
  onResolveCaptureType?: (capture: InboxCapture) => void;
  onBack: () => void;
}

export default function InboxScreen({
  darkMode,
  captures,
  captureJobsByCaptureId,
  onQuickCapture,
  onFileCapture,
  onFileCaptureWithAi,
  onTurnIntoTodos,
  onDeleteCapture,
  onResolveCaptureType,
  onBack,
}: InboxScreenProps) {
  const theme = getTheme(darkMode);
  const readyCount = captures.filter(inboxCaptureIsReadyToFile).length;

  return (
    <View style={[styles.fullScreenView, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Capture Inbox</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        {readyCount > 0
          ? `${readyCount} capture${readyCount === 1 ? ' is' : 's are'} ready to file as cards.`
          : 'Rough thoughts waiting to become cards or todos.'}
      </Text>

      <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]} onPress={onQuickCapture}>
        <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>+ Quick Capture</Text>
      </TouchableOpacity>

      {captures.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.mutedText }]}>Your inbox is clear.</Text>
      ) : (
        captures.map(capture => {
          const job = captureJobsByCaptureId[capture.id];
          const displayStatus = getInboxCaptureDisplayStatus(capture, job);
          const statusLabel = getInboxCaptureStatusLabel(displayStatus);
          const readyToFile = displayStatus === 'ready_to_file';
          const displayTitle = readyToFile
            ? getInboxCaptureDisplayTitle(capture)
            : (capture.title || 'Untitled capture');
          const displayPreview = readyToFile
            ? getInboxCaptureDisplayPreview(capture)
            : capture.content;

          return (
            <View
              key={capture.id}
              style={[
                styles.inboxCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: readyToFile ? theme.accent : theme.border,
                  borderWidth: readyToFile ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.inboxMetaRow}>
                <Text style={[styles.inboxMeta, { color: theme.mutedText }]}>{formatCardDate(capture.createdAt)}</Text>
                <View style={styles.inboxMetaPills}>
                  {capture.intendedType ? (
                    <View style={[styles.inboxTypePill, { borderColor: theme.border, backgroundColor: theme.tertiaryBackground }]}>
                      <Text style={[styles.inboxTypePillText, { color: theme.secondaryButtonText }]}>
                        {capture.intendedType === 'todo' ? 'Todo' : 'Card'}
                      </Text>
                    </View>
                  ) : null}
                  {statusLabel ? (
                    <View
                      style={[
                        styles.inboxStatusPill,
                        {
                          borderColor: readyToFile ? theme.accent : theme.border,
                          backgroundColor: readyToFile ? theme.accentSoft : theme.tertiaryBackground,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.inboxStatusPillText,
                          { color: readyToFile ? theme.accent : theme.secondaryButtonText },
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Text style={[styles.inboxTitle, { color: theme.text }]}>{displayTitle}</Text>
              <Text style={[styles.inboxPreview, { color: theme.text }]} numberOfLines={4}>
                {displayPreview}
              </Text>

              {readyToFile ? (
                <Text style={[styles.inboxReadyHint, { color: theme.accent }]}>
                  Structured draft ready. Tap File This to open the prefilled card form.
                </Text>
              ) : null}

              {displayStatus === 'awaiting_clarification' ? (
                <Text style={[styles.inboxReadyHint, { color: theme.text }]}>
                  Second Mind is not sure whether this is a library note or a task list.
                </Text>
              ) : null}

              {capture.sourceText && !readyToFile ? (
                <Text style={[styles.inboxSource, { color: theme.mutedText }]} numberOfLines={2}>
                  Source: {capture.sourceText}
                </Text>
              ) : null}

              {displayStatus === 'awaiting_clarification' && onResolveCaptureType ? (
                <View style={styles.inboxActionRow}>
                  <TouchableOpacity
                    style={[styles.inboxActionButton, { backgroundColor: theme.primaryButton }]}
                    onPress={() => onResolveCaptureType(capture)}
                  >
                    <Text style={[styles.inboxActionButtonText, { color: theme.primaryButtonText }]}>
                      Choose Type
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.inboxActionRow}>
                <TouchableOpacity
                  style={[
                    styles.inboxActionButton,
                    {
                      backgroundColor: readyToFile ? theme.primaryButton : theme.secondaryBackground,
                      borderWidth: readyToFile ? 0 : 1,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => onFileCapture(capture)}
                >
                  <Text
                    style={[
                      styles.inboxActionButtonText,
                      { color: readyToFile ? theme.primaryButtonText : theme.secondaryButtonText },
                    ]}
                  >
                    File This
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.inboxActionButton,
                    {
                      backgroundColor: readyToFile ? theme.secondaryBackground : theme.primaryButton,
                      borderWidth: readyToFile ? 1 : 0,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => onFileCaptureWithAi(capture)}
                >
                  <Text
                    style={[
                      styles.inboxActionButtonText,
                      { color: readyToFile ? theme.secondaryButtonText : theme.primaryButtonText },
                    ]}
                  >
                    {readyToFile ? 'Re-run AI' : 'File With AI'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inboxActionRow}>
                <TouchableOpacity
                  style={[styles.inboxActionButton, { backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.border }]}
                  onPress={() => onTurnIntoTodos(capture)}
                >
                  <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Turn into Todo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inboxActionButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]}
                  onPress={() => onDeleteCapture(capture)}
                >
                  <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}