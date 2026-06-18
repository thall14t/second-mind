export const getTheme = (darkMode: boolean) => ({
  darkMode,
  background: darkMode ? '#171311' : '#f5efe4',
  cardBackground: darkMode ? '#241c18' : '#fffaf2',
  secondaryBackground: darkMode ? '#3f3027' : '#e7d6bc',
  tertiaryBackground: darkMode ? '#2c221d' : '#efe4d2',
  primaryButton: darkMode ? '#d3a56a' : '#2f241d',
  primaryButtonText: darkMode ? '#1a1410' : '#fcf6ed',
  secondaryButtonText: darkMode ? '#f2e2cb' : '#3b2d22',
  text: darkMode ? '#f7ead7' : '#30231c',
  mutedText: darkMode ? '#c8b39a' : '#746558',
  subtleText: darkMode ? '#af9884' : '#5c5046',
  border: darkMode ? '#59453a' : '#d8c8b2',
  destructive: '#8b3a2f',
  accent: darkMode ? '#d3a56a' : '#7a4b2d',
  accentSoft: darkMode ? '#4e3829' : '#ead7c1',
  shadow: darkMode ? '#000000' : '#8b6d4f',
});

export const getCardTone = (toneKey: string, darkMode: boolean) => {
  const tones: Record<string, { accent: string; wash: string }> = darkMode
    ? {
        '0': { accent: '#c89e67', wash: '#33261d' },
        '1': { accent: '#8fa96e', wash: '#263022' },
        '2': { accent: '#74a7b8', wash: '#21303a' },
        '3': { accent: '#b88ac9', wash: '#31253a' },
        '4': { accent: '#d28a7d', wash: '#3a2522' },
        '5': { accent: '#d1aa62', wash: '#362b1e' },
        '6': { accent: '#8fb8a1', wash: '#213229' },
        '7': { accent: '#d39a7e', wash: '#39291f' },
        '8': { accent: '#7e9fd3', wash: '#202b39' },
        '9': { accent: '#b0a06d', wash: '#312d20' },
        default: { accent: '#d3a56a', wash: '#2c221d' },
      }
    : {
        '0': { accent: '#8a5b35', wash: '#f2e2d0' },
        '1': { accent: '#667e48', wash: '#e7efde' },
        '2': { accent: '#4f8393', wash: '#dff0f3' },
        '3': { accent: '#8b63a6', wash: '#ece2f5' },
        '4': { accent: '#b36d61', wash: '#f6e3df' },
        '5': { accent: '#a77c2f', wash: '#f4ead0' },
        '6': { accent: '#5e8a73', wash: '#e2efe7' },
        '7': { accent: '#b57b53', wash: '#f5e5d8' },
        '8': { accent: '#5c7ab3', wash: '#e2e9f8' },
        '9': { accent: '#8b7a42', wash: '#f0edd8' },
        default: { accent: '#7a4b2d', wash: '#ead7c1' },
      };

  return tones[toneKey] ?? tones.default;
};
