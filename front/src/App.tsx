import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Component Imports
import Studio from './pages/Studio';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

const AppContent = () => {
  return (
    // Main Layout Container
    <div className="h-screen w-full overflow-hidden bg-bg-secondary">
      <div className="h-full w-full overflow-y-auto bg-bg-primary">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/studio" element={<Studio />} />
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
