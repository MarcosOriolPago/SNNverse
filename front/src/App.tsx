import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Component Imports
import Studio from './pages/Studio';
import Home from './pages/Home';

const AppContent = () => {
  return (
    // Main Layout Container
    <div className="h-screen w-full overflow-hidden bg-bg-secondary">
      <div className="h-full w-full overflow-y-auto bg-bg-primary">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/studio" element={<Studio />} />
        </Routes>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;