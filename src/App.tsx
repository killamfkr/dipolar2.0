import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/Login';
import { Discover } from './pages/Discover';
import { LiveTv } from './pages/LiveTv';
import { Vod } from './pages/Vod';
import { Library } from './pages/Library';
import { Settings } from './pages/Settings';

function AppContent() {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <LoginPage />;
  }
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Discover />} />
            <Route path="live" element={<LiveTv />} />
            <Route path="vod" element={<ErrorBoundary fallback={<div style={{ padding: '1rem' }}><h1>VOD</h1><p>This page had an error. Try going back or reload.</p></div>}><Vod /></ErrorBoundary>} />
            <Route path="library" element={<Library />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
