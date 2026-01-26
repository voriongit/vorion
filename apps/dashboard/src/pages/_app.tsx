import '../../styles/globals.css'
import type { AppProps } from 'next/app'
import { ToastProvider } from '../contexts/ToastContext';
import { ToastContainer } from '../components/Toast';
import { RealtimeProvider } from '../contexts/RealtimeContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <RealtimeProvider>
      <ToastProvider>
        <Component {...pageProps} />
        <ToastContainer />
      </ToastProvider>
    </RealtimeProvider>
  );
}
