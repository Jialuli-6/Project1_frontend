import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardTimeline from './components/DashboardTimeline';
import PatentHistogram from './components/PatentHistogram';

const ResearchDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      maxWidth: "1000px", 
      margin: "0 auto", 
      padding: "25px 15px", 
      fontFamily: "Arial, sans-serif",
      backgroundColor: "#fafafa"
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <h1 style={{ color: "#202124", fontSize: "1.8rem" }}>
          Yeshiva University Research Dashboards
        </h1>
        <button
          onClick={() => navigate('/enhanced-citation-network')}
          style={{
            padding: "8px 16px",
            backgroundColor: "#1a73e8",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          View Network Graphs
        </button>
      </div>

      <div style={{ 
        backgroundColor: "white", 
        padding: "20px", 
        borderRadius: "8px", 
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)" 
      }}>
        <DashboardTimeline />
        <PatentHistogram />
        
        <div style={{ marginTop: 30, fontSize: "14px", color: "#666" }}>
          <h4>About the Data</h4>
          <p>The timeline shows the number of computer science-related papers published by Yeshiva University over the past 10 years.</p>
          <p>The histogram displays the distribution of patent citations (Patent_Count) across the paper collection.</p>
        </div>
      </div>
    </div>
  );
};

export default ResearchDashboard;