import '../styles/globals.css';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Sidebar from '@/components/Sidebar';
import CommandBar from '@/components/CommandBar';
import AuthGate from '@/components/AuthGate';

// viewport-fit=cover lets the safe-area insets below actually report values on
// an iPhone running this from the home screen. Lives here rather than in
// _document — Next warns about viewport meta tags there.
const VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';

export default function App({ Component, pageProps }) {
  const router = useRouter();

  if (router.pathname === '/login') {
    return (
      <>
        <Head>
          <title>JARVIS AIO — Sign in</title>
          <meta name="viewport" content={VIEWPORT} />
        </Head>
        <Component {...pageProps} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>JARVIS AIO</title>
        <meta name="viewport" content={VIEWPORT} />
      </Head>
      <AuthGate>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <main className="flex-1 px-4 py-6 pb-28 md:px-8">
            <Component {...pageProps} />
          </main>
        </div>
        <CommandBar />
      </AuthGate>
    </>
  );
}
