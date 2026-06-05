import React from 'react';

// Place your logo files at:
//   src/assets/gie-logo-black.png  (for light themes)
//   src/assets/gie-logo-white.png  (for dark themes)
let logoBlack, logoWhite;
try { logoBlack = new URL('../assets/gie-logo-black.png', import.meta.url).href; } catch(e) {}
try { logoWhite = new URL('../assets/gie-logo-white.png', import.meta.url).href; } catch(e) {}

export default function Footer() {
  // Detect if the page background is dark by checking the CSS variable
  // Dark themes have --bg starting with #1 (like #1c1310, #141414)
  const isDarkBg = typeof window !== 'undefined' &&
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().startsWith('#1');

  const logo = isDarkBg ? logoWhite : logoBlack;

  return (
    <footer style={{
      padding: '16px 24px',
      textAlign: 'center',
      borderTop: '1px solid var(--border)',
      marginTop: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {logo && (
          <img
            src={logo}
            alt="Gem.In.Eyes Productions"
            style={{ height: 20, width: 'auto', opacity: 0.5 }}
          />
        )}
        <span style={{
          fontSize: 11,
          color: 'var(--text-on-bg-dim)',
          letterSpacing: 0.5,
        }}>
          Created by Gem.In.Eyes Productions
        </span>
      </div>
    </footer>
  );
}
