import { Html, Head, Main, NextScript } from 'next/document';

const NO_FLASH_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('aio-theme');
    var wantsDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (wantsDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />

        {/* Icons. The .svg wins in browsers that take it (and follows the theme);
            the .ico is the fallback, and apple-touch-icon is what iOS puts on the
            home screen. */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Add to Home Screen — opens standalone, without browser chrome. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="JARVIS AIO" />
        <meta name="apple-mobile-web-app-title" content="JARVIS AIO" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#FBFBFA" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#131312" media="(prefers-color-scheme: dark)" />

        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </Head>
      <body className="bg-bg font-sans text-ink antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
