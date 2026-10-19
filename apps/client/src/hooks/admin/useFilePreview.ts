'use client';

import { useEffect, useState } from 'react';

/**
 * A file picked in a form plus an object-URL preview of it. The URL is
 * revoked when the file changes or the component unmounts.
 */
export function useFilePreview() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // A preview made for an earlier file is never shown.
  const previewUrl = file && preview?.file === file ? preview.url : null;
  return { file, previewUrl, setFile };
}
