import React from 'react';
import { useNavigate } from 'react-router-dom';

const App: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      maxWidth: "800px",
      margin: "0 auto",
      padding: "50px 20px",
      textAlign: "center",
      fontFamily: "Arial, sans-serif",
      backgroundColor: "#fafafa",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }}>
      <h1 style={{ color: "#202124", fontSize: "2.2rem" }}>
        Yeshiva University Research Data Platform
      </h1>
      <p style={{ fontSize: "1.1rem", color: "#666", margin: "20px 0 40px" }}>
        Welcome to the Yeshiva University Research Data Platform! Click the button below to access the CS Department  Research Interactive Graphs.
      </p>
      <button
        onClick={() => navigate('/networks')}
        style={{
          padding: "12px 30px",
          backgroundColor: "#1a73e8",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "16px"
        }}
      >
        Enter the CS Department Research Interactive Graphs
      </button>
    </div>
  );
};

export default App;