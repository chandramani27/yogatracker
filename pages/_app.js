import "@/styles/globals.css";
import { AuthProvider } from '../components/AuthContext';
import Footer from '../components/Footer';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
     <main className="min-h-screen">
        <Component {...pageProps} />
      </main>
      <Footer />
    </AuthProvider>
  );
}

export default MyApp;