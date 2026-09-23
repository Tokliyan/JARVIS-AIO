import '../styles/globals.css';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Sidebar from '@/components/Sidebar';
import CommandBar from '@/components/CommandBar';
import AuthGate from '@/components/AuthGate';

export default function App({ Component, pageProps }) {
  const router = useRouter();

  if (router.pathname === '/login') {
    return (
      <>
        <Head>
          <title>JARVIS AIO — Sign in</title>
        </Head>
        <Component {...pageProps} />
      </>
    );
  }

  // E-ink preview pages: still password-gated, but no sidebar/command bar -
  // this needs to render exactly like the Kindle would see it, full-bleed.
  if (router.pathname.startsWith('/eink')) {
    return (
      <>
        <Head>
          <title>JARVIS AIO — E-ink preview</title>
        </Head>
        <AuthGate>
          <Component {...pageProps} />
        </AuthGate>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>JARVIS AIO</title>
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
