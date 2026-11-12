/** "550 MB", "1.2 GB". Binary units, matching the server's messages. */
export function formatBytes(bytes: number): string {
  const mb = 1024 * 1024;
  const gb = mb * 1024;
  if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
  if (bytes >= mb) return `${Math.round(bytes / mb)} MB`;
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}

/** "about 3 minutes left", "less than a minute left". */
export function formatEta(bytesLeft: number, bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return 'Working out the time left';
  const seconds = bytesLeft / bytesPerSecond;
  if (seconds < 60) return 'less than a minute left';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} left`;
  const hours = Math.round(minutes / 6) / 10;
  return `about ${hours} ${hours === 1 ? 'hour' : 'hours'} left`;
}

/** "1 hour of audio takes about 5 minutes". `factor` is processing time per second of audio. */
export function formatSpeed(factor: number): string {
  const minutes = Math.round(60 * factor);
  if (minutes < 1) return '1 hour of audio takes less than a minute';
  return `1 hour of audio takes about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
