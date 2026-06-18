import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import ThinkingDots from './ThinkingDots';
import {
  CaptureProcessingJobView,
  buildCaptureProcessingLabel,
  getCaptureJobStatusLabel,
} from '../utils/captureJobs';

interface CaptureProcessingPanelProps {
  darkMode: boolean;
  jobs: CaptureProcessingJobView[];
  visible: boolean;
  onClose: () => void;
}

export function CaptureProcessingIndicator({
  darkMode,
  jobs,
  onPress,
}: {
  darkMode: boolean;
  jobs: CaptureProcessingJobView[];
  onPress: () => void;
}) {
  const theme = getTheme(darkMode);
  if (jobs.length === 0) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.captureProcessingIndicator,
        { backgroundColor: theme.accentSoft, borderColor: theme.border },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <ThinkingDots
        prefix={buildCaptureProcessingLabel(jobs.length)}
        style={[styles.captureProcessingIndicatorText, { color: theme.accent }]}
      />
      <Text style={[styles.captureProcessingIndicatorHint, { color: theme.mutedText }]}>
        Tap for details
      </Text>
    </TouchableOpacity>
  );
}

export default function CaptureProcessingPanel({
  darkMode,
  jobs,
  visible,
  onClose,
}: CaptureProcessingPanelProps) {
  const theme = getTheme(darkMode);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.captureProcessingOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.captureProcessingSheet,
            { backgroundColor: theme.cardBackground, borderColor: theme.border },
          ]}
          onPress={event => event.stopPropagation()}
        >
          <Text style={[styles.captureProcessingSheetTitle, { color: theme.text }]}>
            Processing Captures
          </Text>
          <Text style={[styles.captureProcessingSheetBody, { color: theme.mutedText }]}>
            Second Mind is routing these captures in the background.
          </Text>

          {jobs.length === 0 ? (
            <Text style={[styles.captureProcessingEmptyText, { color: theme.mutedText }]}>
              Nothing is processing right now.
            </Text>
          ) : (
            jobs.map(job => (
              <View
                key={job.jobId}
                style={[
                  styles.captureProcessingJobCard,
                  { backgroundColor: theme.tertiaryBackground, borderColor: theme.border },
                ]}
              >
                <View style={styles.captureProcessingJobHeader}>
                  <Text style={[styles.captureProcessingJobTitle, { color: theme.text }]} numberOfLines={1}>
                    {job.previewTitle}
                  </Text>
                  <View style={[styles.captureProcessingStatusPill, { borderColor: theme.border, backgroundColor: theme.accentSoft }]}>
                    <Text style={[styles.captureProcessingStatusText, { color: theme.secondaryButtonText }]}>
                      {getCaptureJobStatusLabel(job.status)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.captureProcessingJobPreview, { color: theme.mutedText }]} numberOfLines={3}>
                  {job.previewContent}
                </Text>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}