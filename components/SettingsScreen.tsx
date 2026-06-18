import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { getTheme } from '../theme';
import { APP_NAME } from '../branding';

type SettingsSubview = 'main' | 'developer';

interface SettingsScreenProps {
  darkMode: boolean;
  aiAssistEndpoint: string;
  onToggleDarkMode: () => void;
  onAiAssistEndpointChange: (value: string) => void;
  onSeedTestCards: () => void;
  onSeedTestCaptures: () => void;
  onDeleteAllCards: () => void;
  onResetDefault: () => void;
  onResetBlank: () => void;
  onCreateBackup: () => void;
  onRestoreLatestBackup: () => void;
  onShareLatestBackup: () => void;
  onBack: () => void;
}

export default function SettingsScreen({
  darkMode,
  aiAssistEndpoint,
  onToggleDarkMode,
  onAiAssistEndpointChange,
  onSeedTestCards,
  onSeedTestCaptures,
  onDeleteAllCards,
  onResetDefault,
  onResetBlank,
  onCreateBackup,
  onRestoreLatestBackup,
  onShareLatestBackup,
  onBack,
}: SettingsScreenProps) {
  const theme = getTheme(darkMode);
  const [endpointDraft, setEndpointDraft] = useState(aiAssistEndpoint);
  const [activeSubview, setActiveSubview] = useState<SettingsSubview>('main');

  useEffect(() => {
    setEndpointDraft(aiAssistEndpoint);
  }, [aiAssistEndpoint]);

  const handleBack = () => {
    if (activeSubview === 'developer') {
      setActiveSubview('main');
      return;
    }

    onBack();
  };

  const renderMainSettings = () => (
    <>
      <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.secondaryBackground, width: '100%' }]} onPress={onToggleDarkMode}>
        <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>
          Dark Mode: {darkMode ? 'On' : 'Off'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, { backgroundColor: theme.secondaryBackground, width: '100%' }]}
        onPress={() => setActiveSubview('developer')}
      >
        <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>Developer Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.deleteButton, { width: '100%' }]} onPress={onDeleteAllCards}>
        <Text style={styles.deleteButtonText}>Delete All Cards</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.secondaryBackground, width: '100%' }]} onPress={onResetDefault}>
        <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>Reset All Categories To Default</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.deleteButton, { width: '100%' }]} onPress={onResetBlank}>
        <Text style={styles.deleteButtonText}>Reset All Categories To Blank</Text>
      </TouchableOpacity>

      <Text style={[styles.helperText, { color: theme.mutedText, marginTop: 24 }]}>
        Blank reset keeps the range structure but clears the leaf categories and custom categories.
      </Text>

      <Text style={[styles.brandFooter, { color: theme.mutedText }]}>{APP_NAME}</Text>
    </>
  );

  const renderDeveloperSettings = () => (
    <>
      <Text style={[styles.helperText, { color: theme.mutedText }]}>
        Developer tools for AI testing, local server setup, and demo data.
      </Text>

      <View style={[styles.settingsPanel, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.settingsPanelTitle, { color: theme.text }]}>AI Assist Server</Text>
        <Text style={[styles.helperText, { color: theme.mutedText }]}>
          For local dev use your computer's IP (e.g. http://192.168.1.10:3001). For Render/cloud trialing, use your Render URL (e.g. https://second-mind-ai.onrender.com). The API key stays on the server.
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
          value={endpointDraft}
          onChangeText={setEndpointDraft}
          placeholder="https://second-mind-ai.onrender.com"
          placeholderTextColor={theme.mutedText}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: theme.secondaryBackground, width: '100%' }]}
          onPress={() => onAiAssistEndpointChange(endpointDraft)}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>Save AI Server URL</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.secondaryBackground, width: '100%' }]} onPress={onSeedTestCards}>
        <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>Add 50 Test Cards</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.secondaryBackground, width: '100%' }]} onPress={onSeedTestCaptures}>
        <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>Add 20 Test Quick Captures</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, { backgroundColor: theme.accentSoft, width: '100%', marginTop: 12 }]}
        onPress={onCreateBackup}
      >
        <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>Create Full Backup</Text>
      </TouchableOpacity>

      <Text style={[styles.helperText, { color: theme.mutedText, marginTop: 4, fontSize: 12 }]}>
        Saves cards, inbox, categories, and settings to a single timestamped file.
      </Text>

      <TouchableOpacity
        style={[styles.deleteButton, { width: '100%', marginTop: 16 }]}
        onPress={onRestoreLatestBackup}
      >
        <Text style={styles.deleteButtonText}>Restore Latest Backup</Text>
      </TouchableOpacity>

      <Text style={[styles.helperText, { color: theme.mutedText, marginTop: 4, fontSize: 12 }]}>
        Finds the most recent backup in the app folder and replaces your current data.
      </Text>

      <TouchableOpacity
        style={[styles.secondaryButton, { backgroundColor: theme.accentSoft, width: '100%', marginTop: 12 }]}
        onPress={onShareLatestBackup}
      >
        <Text style={[styles.secondaryButtonText, { color: theme.secondaryButtonText }]}>Share Latest Backup</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={[styles.fullScreenView, { backgroundColor: theme.background }]}>
      <Text style={[styles.formTitle, { color: theme.text }]}>
        {activeSubview === 'developer' ? 'Developer Settings' : 'Settings'}
      </Text>

      {activeSubview === 'developer' ? renderDeveloperSettings() : renderMainSettings()}

      <TouchableOpacity style={styles.cancelButton} onPress={handleBack}>
        <Text style={styles.cancelButtonText}>{activeSubview === 'developer' ? 'Back To Settings' : 'Back'}</Text>
      </TouchableOpacity>
    </View>
  );
}
