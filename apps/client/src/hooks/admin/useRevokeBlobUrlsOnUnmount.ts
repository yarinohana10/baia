'use client';

import { useEffect, useRef } from 'react';

/** Releases the blob previews of not-yet-uploaded images when the form goes away. */
export function useRevokeBlobUrlsOnUnmount(images: { url: string; file?: File }[]) {
  const latest = useRef(images);

  useEffect(() => {
    latest.current = images;
  }, [images]);

  useEffect(
    () => () => {
      latest.current.forEach((img) => img.file && URL.revokeObjectURL(img.url));
    },
    [],
  );
}
