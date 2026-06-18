import React, { useEffect, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { APP_NAME, APP_TAGLINE } from '../branding';
import { CaptureClarificationBanner } from './CaptureClarificationModal';
import CaptureProcessingPanel, { CaptureProcessingIndicator } from './CaptureProcessingPanel';
import { CaptureProcessingJobView } from '../utils/captureJobs';

interface HomeScreenProps {
  cardCount: number;
  inboxCount: number;
  todoCount: number;
  processingJobs: CaptureProcessingJobView[];
  clarificationLabel: string;
  onOpenClarification: () => void;
  darkMode: boolean;
  onAskCards: () => void;
  onQuickCapture: () => void;
  onNewCard: () => void;
  onViewCards: () => void;
  onOpenInbox: () => void;
  onOpenTodos: () => void;
  onBrowseCategories: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export default function HomeScreen({
  cardCount,
  inboxCount,
  todoCount,
  processingJobs,
  clarificationLabel,
  onOpenClarification,
  darkMode,
  onAskCards,
  onQuickCapture,
  onNewCard,
  onViewCards,
  onOpenInbox,
  onOpenTodos,
  onBrowseCategories,
  onOpenSettings,
  onOpenHelp,
}: HomeScreenProps) {
  const [processingPanelVisible, setProcessingPanelVisible] = useState(false);
  const theme = getTheme(darkMode);

  useEffect(() => {
    if (processingJobs.length === 0) {
      setProcessingPanelVisible(false);
    }
  }, [processingJobs.length]);
  const cardShadow = darkMode
    ? { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 }
    : { shadowColor: theme.shadow, shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 7 };

  return (
    <>
      <View
        style={[
          styles.heroCard,
          cardShadow,
          {
            backgroundColor: theme.cardBackground,
            borderWidth: 1,
            borderColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.heroCornerButton,
            styles.heroCornerLeft,
            { backgroundColor: theme.tertiaryBackground, borderWidth: 1, borderColor: theme.border },
          ]}
          onPress={onOpenSettings}
        >
          <Text style={[styles.heroCornerText, { color: theme.secondaryButtonText }]}>{'\u2699'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.heroCornerButton,
            styles.heroCornerRight,
            { backgroundColor: theme.tertiaryBackground, borderWidth: 1, borderColor: theme.border },
          ]}
          onPress={onOpenHelp}
        >
          <Text style={[styles.heroCornerText, { color: theme.secondaryButtonText }]}>?</Text>
        </TouchableOpacity>
        <View style={[styles.brandMark, { backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.border }]}>
          <Image
            source={require('../assets/second-mind-logo.jpg')}
            style={styles.brandImage}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{APP_NAME}</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>{APP_TAGLINE}</Text>
        <View style={styles.homeStatRow}>
          <TouchableOpacity
            style={[styles.heroStatPill, { backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.border }]}
            onPress={onViewCards}
            activeOpacity={0.7}
          >
            <Text style={[styles.heroStatText, { color: theme.secondaryButtonText }]}>Cards: {cardCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.heroStatPill, { backgroundColor: theme.tertiaryBackground, borderWidth: 1, borderColor: theme.border }]}
            onPress={onOpenInbox}
            activeOpacity={0.7}
          >
            <Text style={[styles.heroStatText, { color: theme.secondaryButtonText }]}>Inbox: {inboxCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.heroStatPill, { backgroundColor: theme.tertiaryBackground, borderWidth: 1, borderColor: theme.border }]}
            onPress={onOpenTodos}
            activeOpacity={0.7}
          >
            <Text style={[styles.heroStatText, { color: theme.secondaryButtonText }]}>Todos: {todoCount}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CaptureClarificationBanner
        darkMode={darkMode}
        label={clarificationLabel}
        onPress={onOpenClarification}
      />

      <CaptureProcessingIndicator
        darkMode={darkMode}
        jobs={processingJobs}
        onPress={() => setProcessingPanelVisible(true)}
      />
      <CaptureProcessingPanel
        darkMode={darkMode}
        jobs={processingJobs}
        visible={processingPanelVisible}
        onClose={() => setProcessingPanelVisible(false)}
      />

      <View style={styles.homePrimaryActions}>
        <TouchableOpacity
          style={[
            styles.homePrimaryButton,
            cardShadow,
            { backgroundColor: theme.primaryButton },
          ]}
          onPress={onQuickCapture}
        >
          <Text style={[styles.buttonText, { color: theme.primaryButtonText }]}>Quick Capture</Text>
          <Text style={[styles.homePrimaryMeta, { color: theme.primaryButtonText }]}>Catch the thought before it fades</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.homePrimaryButton,
            { backgroundColor: theme.tertiaryBackground, borderWidth: 1, borderColor: theme.border },
          ]}
          onPress={onAskCards}
        >
          <Text style={[styles.homePrimaryTitle, { color: theme.secondaryButtonText }]}>Ask My Cards</Text>
          <Text style={[styles.homePrimaryMeta, { color: theme.mutedText }]}>Question your notes and surface connections</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.homeUtilityGrid}>
        <TouchableOpacity
          style={[
            styles.homeUtilityTile,
            { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border },
          ]}
          onPress={onNewCard}
        >
          <Text style={[styles.homeUtilityTitle, { color: theme.text }]}>+ New Card</Text>
          <Text style={[styles.homeUtilityMeta, { color: theme.mutedText }]}>Manual filing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.homeUtilityTile,
            { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border },
          ]}
          onPress={onBrowseCategories}
        >
          <Text style={[styles.homeUtilityTitle, { color: theme.text }]}>Categories</Text>
          <Text style={[styles.homeUtilityMeta, { color: theme.mutedText }]}>Browse structure</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
