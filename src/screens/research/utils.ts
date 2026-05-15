import { Alert, Linking } from 'react-native';

export async function openURL(url: string | undefined | null) {
  if (!url) { Alert.alert('Link unavailable', 'No URL was provided.'); return; }
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) { await Linking.openURL(url); }
    else { Alert.alert('Cannot open link', 'Your device cannot open this URL.'); }
  } catch { Alert.alert('Error', 'Unable to open this link.'); }
}
