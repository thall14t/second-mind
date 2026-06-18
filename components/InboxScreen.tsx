import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { InboxCapture } from '../types';
import { formatCardDate } from '../utils/antinet';

interface InboxScreenProps {
  darkMode: boolean;
  captures: InboxCapture[];
  onQuickCapture: () => void;
  onFileCapture: (capture: InboxCapture) => void;
  onFileCaptureWithAi: (capture: InboxCapture) => void;
  onDeleteCapture: (capture: InboxCapture) => void;
  onBack: () => void;
}

export default function InboxScreen({
  darkMode,
  captures,
  onQuickCapture,
  onFileCapture,
  onFileCaptureWithAi,
  onDeleteCapture,
  onBack,
}: InboxScreenProps) {
  const theme = getTheme(darkMode);

  return (
    <View style={[styles.fullScreenView, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Capture Inbox</Text>
      <Text style={[styles.contextText, { color: theme.mutedText }]}>
        Rough thoughts waiting to become real cards.
      </Text>

      <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]} onPress={onQuickCapture}>
        <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>+ Quick Capture</Text>
      </TouchableOpacity>

      {captures.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.mutedText }]}>Your inbox is clear.</Text>
      ) : (
        captures.map(capture => (
          <View key={capture.id} style={[styles.inboxCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <Text style={[styles.inboxMeta, { color: theme.mutedText }]}>{formatCardDate(capture.createdAt)}</Text>
            <Text style={[styles.inboxTitle, { color: theme.text }]}>{capture.title || 'Untitled capture'}</Text>
            <Text style={[styles.inboxPreview, { color: theme.text }]} numberOfLines={4}>{capture.content}</Text>
            {capture.sourceText && (
              <Text style={[styles.inboxSource, { color: theme.mutedText }]} numberOfLines={2}>Source: {capture.sourceText}</Text>
            )}
            <View style={styles.inboxActionRow}>
              <TouchableOpacity
                style={[styles.inboxActionButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => onFileCapture(capture)}
              >
                <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>File This</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inboxActionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => onFileCaptureWithAi(capture)}
              >
                <Text style={[styles.inboxActionButtonText, { color: theme.primaryButtonText }]}>File With AI</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.inboxActionButton, { backgroundColor: theme.secondaryBackground, borderWidth: 1, borderColor: theme.border }]} onPress={() => onDeleteCapture(capture)}>
                <Text style={[styles.inboxActionButtonText, { color: theme.secondaryButtonText }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}
