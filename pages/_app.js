import "../styles/globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import Layout from "../components/Layout";

export default function MyApp({ Component, pageProps }) {
  // Check if the page should use a different layout
  const getLayout = Component.getLayout || ((page) => <Layout>{page}</Layout>);

  return (
    <LanguageProvider>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1a2245",
              color: "#e8ecf5",
              border: "1px solid rgba(140, 43, 255, 0.3)",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#e8ecf5",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#e8ecf5",
              },
            },
          }}
        />
        {getLayout(<Component {...pageProps} />)}
      </AuthProvider>
    </LanguageProvider>
  );
}
