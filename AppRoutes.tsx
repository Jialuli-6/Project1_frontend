
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App'; // first page（/）
import ResearchDashboard from './ResearchDashboard'; // Front page（/dashboard）
import NetworkGraphs from './NetworkGraphs'; // Web Graphic Page（/networks）
import CitationNetworkPage from './CitationNetworkPage'; // Import new components
import CitationNetworksDashboard from './CitationNetworksDashboard';
const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} /> {/* The root path corresponds to the App component. */}
        <Route path="/networks" element={<NetworkGraphs />} />
        <Route path="/dashboard" element={<ResearchDashboard />} />
        {/* Add a new page route; here, we'll use `/citation-network` as the access path. */}
        <Route path="/enhanced-citation-network" element={<CitationNetworksDashboard />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;