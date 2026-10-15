import { ImageResponse } from 'next/og';

export const alt = 'BAIA Swimwear — Mediterranean swimwear for the whole family';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand card used as the default OG/Twitter image (product pages override it with the product photo).
// Latin-only text so no Hebrew font has to be bundled into the edge image renderer.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0F2A36 0%, #1B4965 70%, #337389 100%)',
          color: '#FAF6EF',
          fontFamily: 'serif',
        }}
      >
        <div style={{ fontSize: 148, letterSpacing: 40, paddingLeft: 40 }}>BAIA</div>
        <div style={{ fontSize: 26, letterSpacing: 18, marginTop: 8, color: '#E8B04B', fontFamily: 'sans-serif' }}>
          SWIMWEAR
        </div>
        <div style={{ fontSize: 34, marginTop: 56, opacity: 0.85 }}>Mediterranean swimwear for the whole family</div>
      </div>
    ),
    size,
  );
}
