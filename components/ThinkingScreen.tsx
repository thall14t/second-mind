import React from 'react';
import { Text, View } from 'react-native';
import { ThinkingState } from '../types';
import { styles } from '../styles';
import { getTheme } from '../theme';
import ThinkingDots from './ThinkingDots';

interface ThinkingScreenProps {
  darkMode: boolean;
  thinkingState: ThinkingState | null;
}

const stepGlyph = {
  pending: '...',
  active: '...',
  done: 'OK',
} as const;

export default function ThinkingScreen({ darkMode, thinkingState }: ThinkingScreenProps) {
  const theme = getTheme(darkMode);

  const activeState = thinkingState ?? {
    kind: 'structure' as const,
    title: 'Thinking',
    body: 'Second Mind is preparing your result.',
    steps: [],
  };

  const structurePreview = activeState.kind === 'structure' ? activeState.structurePreview : undefined;
  const filingPreview = activeState.kind === 'filing' ? activeState.filingPreview : undefined;

  return (
    <View style={[styles.thinkingScreen, { backgroundColor: theme.background }]}>
      <View style={[styles.thinkingCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <ThinkingDots prefix={activeState.title} style={[styles.thinkingTitle, { color: theme.text }]} />
        <Text style={[styles.thinkingBody, { color: theme.mutedText }]}>{activeState.body}</Text>

        <View style={styles.thinkingStepList}>
          {activeState.steps.map(step => (
            <View
              key={`${step.label}-${step.value ?? ''}`}
              style={[styles.thinkingStepCard, { backgroundColor: theme.secondaryBackground, borderColor: theme.border }]}
            >
              <View style={styles.thinkingStepTopRow}>
                <Text style={[styles.thinkingStepLabel, { color: theme.text }]}>{step.label}</Text>
                <View
                  style={[
                    styles.thinkingStepBadge,
                    {
                      backgroundColor:
                        step.state === 'done'
                          ? theme.primaryButton
                          : step.state === 'active'
                            ? theme.accentSoft
                            : theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.thinkingStepBadgeText,
                      {
                        color: step.state === 'done' ? theme.primaryButtonText : theme.text,
                      },
                    ]}
                  >
                    {stepGlyph[step.state]}
                  </Text>
                </View>
              </View>
              <Text style={[styles.thinkingStepValue, { color: theme.mutedText }]}>
                {step.value || (step.state === 'pending' ? 'Waiting for the next step' : 'Working')}
              </Text>
            </View>
          ))}
        </View>

        {structurePreview && (
          <View style={[styles.thinkingPreviewPanel, { backgroundColor: theme.secondaryBackground, borderColor: theme.border }]}>
            <Text style={[styles.thinkingPreviewEyebrow, { color: theme.accent }]}>Capture split</Text>
            <View style={[styles.thinkingPreviewCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <Text style={[styles.thinkingPreviewTitle, { color: theme.text }]}>
                {structurePreview.title || 'Working title'}
              </Text>
              <Text style={[styles.thinkingPreviewBody, { color: theme.mutedText }]} numberOfLines={4}>
                {structurePreview.body || 'Looking for the main idea...'}
              </Text>
              <View style={styles.thinkingPreviewMetaGrid}>
                <View style={[styles.thinkingPreviewMetaItem, { borderColor: theme.border }]}>
                  <Text style={[styles.thinkingPreviewMetaLabel, { color: theme.subtleText }]}>Type</Text>
                  <Text style={[styles.thinkingPreviewMetaValue, { color: theme.text }]}>{structurePreview.sourceType}</Text>
                </View>
                <View style={[styles.thinkingPreviewMetaItem, { borderColor: theme.border }]}>
                  <Text style={[styles.thinkingPreviewMetaLabel, { color: theme.subtleText }]}>Source</Text>
                  <Text style={[styles.thinkingPreviewMetaValue, { color: theme.text }]} numberOfLines={2}>
                    {structurePreview.sourceTitle || 'None'}
                  </Text>
                </View>
                <View style={[styles.thinkingPreviewMetaItem, { borderColor: theme.border }]}>
                  <Text style={[styles.thinkingPreviewMetaLabel, { color: theme.subtleText }]}>Author</Text>
                  <Text style={[styles.thinkingPreviewMetaValue, { color: theme.text }]} numberOfLines={2}>
                    {structurePreview.author || 'None'}
                  </Text>
                </View>
                <View style={[styles.thinkingPreviewMetaItem, { borderColor: theme.border }]}>
                  <Text style={[styles.thinkingPreviewMetaLabel, { color: theme.subtleText }]}>Location</Text>
                  <Text style={[styles.thinkingPreviewMetaValue, { color: theme.text }]}>
                    {structurePreview.location || 'None'}
                  </Text>
                </View>
              </View>
              {structurePreview.corrections.length > 0 && (
                <View style={styles.thinkingCorrectionList}>
                  {structurePreview.corrections.slice(0, 2).map(correction => (
                    <Text key={correction} style={[styles.thinkingCorrectionLine, { color: theme.mutedText }]} numberOfLines={1}>
                      {correction}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {filingPreview && (
          <View style={[styles.thinkingPreviewPanel, { backgroundColor: theme.secondaryBackground, borderColor: theme.border }]}>
            <Text style={[styles.thinkingPreviewEyebrow, { color: theme.accent }]}>Filing path</Text>
            <View style={[styles.thinkingFilingRail, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
              <View style={[styles.thinkingFilingStop, { borderColor: theme.border }]}>
                <Text style={[styles.thinkingPreviewMetaLabel, { color: theme.subtleText }]}>Master range</Text>
                <Text style={[styles.thinkingPreviewMetaValue, { color: theme.text }]}>
                  {filingPreview.topMasterRange || 'Scanning'}
                </Text>
                <Text style={[styles.thinkingPreviewBody, { color: theme.mutedText }]} numberOfLines={2}>
                  {filingPreview.topMasterRangeTitle || 'Finding the strongest shelf'}
                </Text>
              </View>
              <View style={[styles.thinkingFilingConnector, { backgroundColor: theme.border }]} />
              <View style={[styles.thinkingFilingStop, { borderColor: theme.border }]}>
                <Text style={[styles.thinkingPreviewMetaLabel, { color: theme.subtleText }]}>Category</Text>
                <Text style={[styles.thinkingPreviewMetaValue, { color: theme.text }]}>
                  {filingPreview.selectedCategory || 'Choosing'}
                </Text>
                <Text style={[styles.thinkingPreviewBody, { color: theme.mutedText }]} numberOfLines={2}>
                  {filingPreview.selectedCategoryTitle || 'Narrowing to a leaf category'}
                </Text>
              </View>
              <View style={[styles.thinkingFilingConnector, { backgroundColor: theme.border }]} />
              <View style={[styles.thinkingFilingStop, { borderColor: theme.border }]}>
                <Text style={[styles.thinkingPreviewMetaLabel, { color: theme.subtleText }]}>Address</Text>
                <Text style={[styles.thinkingPreviewMetaValue, { color: theme.text }]}>
                  {filingPreview.suggestedAddress || 'Next open slot'}
                </Text>
                <Text style={[styles.thinkingPreviewBody, { color: theme.mutedText }]} numberOfLines={2}>
                  {filingPreview.draftTitle || 'Preparing your card draft'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
