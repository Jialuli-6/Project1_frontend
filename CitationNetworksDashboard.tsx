// CitationNetworksDashboard.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import EnhancedCitationNetwork from './components/EnhancedCitationNetwork';
import EnhancedCitationNetworkV2 from './components/EnhancedCitationNetworkV2';
import EnhancedCitationNetworkV1 from './components/EnhancedCitationNetworkV1';

const CitationNetworksDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      maxWidth: "1400px", 
      margin: "0 auto", 
      padding: "25px 15px", 
      fontFamily: "Arial, sans-serif",
      backgroundColor: "#fafafa"
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <h1 style={{ color: "#202124", fontSize: "1.8rem" }}>
          Citation Network Visualizations
        </h1>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: "8px 16px",
            backgroundColor: "#1a73e8",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Back to First Page
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <h1 style={{ color: '#2c3e50' }}></h1>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Return to Previous page
        </button>
      </div>



      <div style={{ 
        backgroundColor: "white", 
        padding: "20px", 
        borderRadius: "8px", 
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)" 
      }}>
        {/* Display two network visualizations side by side */}
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          marginBottom: '30px',
          height: '800px'  // A fixed height ensures that the two visualization areas are of the same size.
        }}>
          {/* Left side: Original enhanced citation V1 network */}
          <div style={{ 
            flex: 1, 
            border: '1px solid #eee', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <h3 style={{ padding: '10px', margin: '0', backgroundColor: '#f5f5f5' }}>
              Hierarchical Edge Bundling(Radial Layout)
            </h3>
            <EnhancedCitationNetworkV1 
              apiUrl="/api/enhanced-citation-network" 
            />
          </div>

          {/* Right side: Version  network */}
          <div style={{ 
            flex: 1, 
            border: '1px solid #eee', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <h3 style={{ padding: '10px', margin: '0', backgroundColor: '#f5f5f5' }}>
            Hierarchical Edge Bundling(Balloon Layout)
            </h3>
            <EnhancedCitationNetwork
              apiUrl="/api/enhanced-citation-network" 
            />
          </div>
        </div>

        {/* Below: Community clustering layout graph */}
        <div style={{ 
          border: '1px solid #eee', 
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '20px'
        }}>
          <h3 style={{ padding: '10px', margin: '0', backgroundColor: '#f5f5f5' }}>
          </h3>
          <EnhancedCitationNetworkV2 
            apiUrl="/api/enhanced-citation-network" 
            title="Community-Clustered Citation Network"
          />
        </div>
        
        <div style={{ marginTop: 30, fontSize: "14px", color: "#666" }}>
          <h4>About the Visualizations</h4>
          <p>Three different approaches to visualizing the same citation network data:</p>
          <ul>
            <li><strong>Hierarchical Edge Bundling(Radial Layout):</strong> Nodes are organized by publication year in concentric circles, with edges bundled to reduce clutter.</li>
            <li><strong>Hierarchical Edge Bundling(Balloon Layout):</strong> Nodes are grouped by publication year in separate clusters, maintaining visual separation between different years.</li>
            <li><strong>Community Clustering:</strong> Nodes are grouped by their connection patterns(The connection relationship between nodes) using a force-directed layout that enhances cluster separation.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
export default CitationNetworksDashboard;