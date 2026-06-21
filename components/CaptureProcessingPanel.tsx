import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import ThinkingDots from './ThinkingDots';
import {
  CaptureProcessingJobView,
  buildCaptureProcessingLabel,
  getCaptureJobPipelineStep,
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
        prefix={buildCaptureProcessingLabel(jobs.length, jobs.length === 1 ? jobs[0].status : undefined)}
        style={[styles.captureProcessingIndicatorText, { color: theme.accent }]}
      />
      <Text style={[styles.captureProcessingIndicatorHint, { color: theme.mutedText }]}>
        Tap for details
      </Text>
    </TouchableOpacity>
  );
}

const PIPELINE_STEPS: { key: import('../utils/captureJobs').CaptureJobPipelineStep; label: string }[] = [
  { key: 'classify', label: 'Reading' },
  { key: 'route', label: 'Routing' },
  { key: 'complete', label: 'Done' },
];

function PipelineSteps({ status, theme }: { status: import('../types').CaptureJobStatus; theme: ReturnType<typeof import('../theme').getTheme> }) {
  const activeStep = getCaptureJobPipelineStep(status);
  const activeIndex = PIPELINE_STEPS.findIndex(s => s.key === activeStep);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 2 }}>
      {PIPELINE_STEPS.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <React.Fragment key={step.key}>
            <View style={{ alignItems: 'center' }}>
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: isDone ? theme.accent : isActive ? theme.accent : theme.border,
                opacity: isActive ? 1 : isDone ? 0.5 : 0.3,
              }} />
              <Text style={{ fontSize: 9, marginTop: 2, color: isActive ? theme.accent : theme.mutedText, opacity: isActive ? 1 : 0.6 }}>
                {step.label}
              </Text>
            </View>
            {i < PIPELINE_STEPS.length - 1 && (
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border, marginBottom: 10, opacity: 0.4 }} />
            )}
          </React.Fragment>
        );
      })}
    </View>
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
                <PipelineSteps status={job.status} theme={theme} />
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