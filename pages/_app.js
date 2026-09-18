import '../styles/globals.css';
import { useRouter } from 'next/router';
import Sidebar from '@/components/Sidebar';
import CommandBar from '@/components/CommandBar';
import AuthGate from '@/components/AuthGate';

export default function App({ Component, pageProps }) {
  const router = useRouter();

  if (router.pathname === '/login') {
    return <Component {...pageProps} />;
  }

  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 px-4 py-6 pb-28 md:px-8">
          <Component {...pageProps} />
        </main>
      </div>
      <CommandBar />
    </AuthGate>
  );
}
