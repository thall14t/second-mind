import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { APP_NAME } from '../branding';
import { styles } from '../styles';
import { getTheme } from '../theme';

interface HelpScreenProps {
  darkMode: boolean;
  onBack: () => void;
}

export default function HelpScreen({ darkMode, onBack }: HelpScreenProps) {
  const theme = getTheme(darkMode);

  return (
    <View style={[styles.fullScreenView, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>Help & Updates</Text>
      <View style={[styles.helpBadge, { backgroundColor: theme.accentSoft }]}>
        <Text style={[styles.helpBadgeText, { color: theme.accent }]}>Pinned for upcoming update</Text>
      </View>

      <View style={[styles.helpCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.helpTitle, { color: theme.text }]}>Related cards</Text>
        <Text style={[styles.helpBody, { color: theme.subtleText }]}>
          For now, enter related card addresses separated by commas, like 0101a, 3101b. Those links show up inside the full card view.
        </Text>
      </View>

      <View style={[styles.helpCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.helpTitle, { color: theme.text }]}>Soon: smarter linking</Text>
        <Text style={[styles.helpBody, { color: theme.subtleText }]}>
          A better version would let you search cards, tap to link them, show backlinks automatically, and suggest related cards from matching tags or categories.
        </Text>
      </View>

      <View style={[styles.helpCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.helpTitle, { color: theme.text }]}>How to use status</Text>
        <Text style={[styles.helpBody, { color: theme.subtleText }]}>
          Seed means captured. Growing means developing. Evergreen means mature enough to revisit and build on.
        </Text>
      </View>

      <Text style={[styles.brandFooter, { color: theme.mutedText }]}>{APP_NAME}</Text>

      <TouchableOpacity style={styles.cancelButton} onPress={onBack}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}
