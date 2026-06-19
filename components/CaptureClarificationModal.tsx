import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { CaptureClarificationJobView } from '../utils/captureJobs';

interface CaptureClarificationModalProps {
  darkMode: boolean;
  job: CaptureClarificationJobView | null;
  visible: boolean;
  onChooseCard: () => void;
  onChooseTodo: () => void;
  onSubmitAnswer: (answer: string) => void;
  onDecideLater: () => void;
}

export function CaptureClarificationBanner({
  darkMode,
  label,
  hint,
  onPress,
}: {
  darkMode: boolean;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const theme = getTheme(darkMode);
  if (!label) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.captureClarificationBanner,
        { backgroundColor: theme.tertiaryBackground, borderColor: theme.border },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.captureClarificationBannerText, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.captureClarificationBannerHint, { color: theme.mutedText }]}>
        {hint}
      </Text>
    </TouchableOpacity>
  );
}

export default function CaptureClarificationModal({
  darkMode,
  job,
  visible,
  onChooseCard,
  onChooseTodo,
  onSubmitAnswer,
  onDecideLater,
}: CaptureClarificationModalProps) {
  const theme = getTheme(darkMode);
  const [answer, setAnswer] = useState('');
  const isRouteChoice = !job || job.inputType === 'route_choice' || job.stage === 'classify';

  useEffect(() => {
    if (visible) {
      setAnswer('');
    }
  }, [visible, job?.jobId, job?.prompt]);

  const handleSubmitAnswer = () => {
    const trimmed = answer.trim();
    if (!trimmed) {
      return;
    }
    onSubmitAnswer(trimmed);
  };

  return (
    <Modal
      visible={visible && job !== null}
      transparent
      animationType="fade"
      onRequestClose={onDecideLater}
    >
      <Pressable style={styles.captureProcessingOverlay} onPress={onDecideLater}>
        <Pressable
          style={[
            styles.captureClarificationSheet,
            { backgroundColor: theme.cardBackground, borderColor: theme.border },
          ]}
          onPress={event => event.stopPropagation()}
        >
          <Text style={[styles.captureClarificationTitle, { color: theme.text }]}>
            {isRouteChoice ? 'What kind of capture is this?' : 'Second Mind needs one detail'}
          </Text>
          <Text style={[styles.captureClarificationBody, { color: theme.mutedText }]}>
            {job?.prompt}
          </Text>

          {job ? (
            <View
              style={[
                styles.captureClarificationPreviewCard,
                { backgroundColor: theme.tertiaryBackground, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.captureClarificationPreviewTitle, { color: theme.text }]} numberOfLines={1}>
                {job.previewTitle}
              </Text>
              <Text style={[styles.captureClarificationPreviewBody, { color: theme.mutedText }]} numberOfLines={4}>
                {job.previewContent}
              </Text>
            </View>
          ) : null}

          {isRouteChoice ? (
            <>
              <TouchableOpacity
                style={[styles.captureClarificationPrimaryButton, { backgroundColor: theme.primaryButton }]}
                onPress={onChooseCard}
              >
                <Text style={[styles.captureClarificationPrimaryButtonText, { color: theme.primaryButtonText }]}>
                  Library Note
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.captureClarificationSecondaryButton,
                  { backgroundColor: theme.accentSoft, borderColor: theme.border },
                ]}
                onPress={onChooseTodo}
              >
                <Text style={[styles.captureClarificationSecondaryButtonText, { color: theme.secondaryButtonText }]}>
                  Task List
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={[
                  styles.captureClarificationInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.tertiaryBackground,
                    borderColor: theme.border,
                  },
                ]}
                value={answer}
                onChangeText={setAnswer}
                placeholder={job?.inputType === 'date' ? 'YYYY-MM-DD or your answer' : 'Your answer'}
                placeholderTextColor={theme.mutedText}
                multiline={job?.inputType !== 'date'}
                autoFocus
              />

              <TouchableOpacity
                style={[
                  styles.captureClarificationPrimaryButton,
                  {
                    backgroundColor: theme.primaryButton,
                    opacity: answer.trim() ? 1 : 0.5,
                  },
                ]}
                onPress={handleSubmitAnswer}
                disabled={!answer.trim()}
              >
                <Text style={[styles.captureClarificationPrimaryButtonText, { color: theme.primaryButtonText }]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onDecideLater}>
            <Text style={styles.cancelButtonText}>Decide Later</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}