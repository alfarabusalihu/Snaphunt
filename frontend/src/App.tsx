import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Config } from './pages/Config';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/config" element={<Config />} />
      </Routes>
    </Router>
  );
}

export default App;
