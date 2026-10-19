'use client';

import { useCallback, useRef, useState } from 'react';

/** Hands a downloaded blob to the browser as a file. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Fetches a file (e.g. a CSV export) and saves it. `download` resolves to
 * false when the request failed; a second call while one runs is ignored.
 */
export function useFileDownload() {
  const [downloading, setDownloading] = useState(false);
  const busy = useRef(false);

  const download = useCallback(async (fetchFile: () => Promise<Blob>, filename: string): Promise<boolean> => {
    if (busy.current) return true;
    busy.current = true;
    setDownloading(true);
    try {
      saveBlob(await fetchFile(), filename);
      return true;
    } catch {
      return false;
    } finally {
      busy.current = false;
      setDownloading(false);
    }
  }, []);

  return { downloading, download };
}
