import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Component Imports
import Studio from './pages/Studio';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

const RequireAuth = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-bg-primary text-text-primary">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const AppContent = () => {
  return (
    // Main Layout Container
    <div className="h-screen w-full overflow-hidden bg-bg-secondary">
      <div className="h-full w-full overflow-y-auto bg-bg-primary">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/studio"
            element={
              <RequireAuth>
                <Studio />
              </RequireAuth>
            }
          />
        </Routes>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;