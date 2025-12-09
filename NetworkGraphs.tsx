import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BaseNetwork from './components/BaseNetwork';
import AuthorCollabNetwork from './components/AuthorCollabNetwork';

// Network graph configuration type
interface NetworkConfig {
  title: string;
  maxNodes: number;
  enableZoom: boolean;
}

// Node type definitions (consistent with child components)
interface BaseNode extends d3.SimulationNodeDatum {
  id: string;
  paperid: string;
  name: string;
  publish_year: number;
  citation_count: number;
  institution: string;
  institutionid?: string;
}

interface AuthorNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'author';
  authorid: string;
  institutionid: string;
  paper_count: number;
  name: string;
  collaboration_count?: number;
}

interface PaperNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'paper';
  paperid: string;
  author_count: number;
  name: string;
}

type CollabNode = AuthorNode | PaperNode;

// Edge type definitions (consistent with child components)
interface CitationLink extends d3.SimulationLinkDatum<BaseNode> {
  source: string | BaseNode;
  target: string | BaseNode;
  citing_year: number;
  cited_year: number;
  year_diff: number;
  value: number;
}

interface AuthorPaperLink extends d3.SimulationLinkDatum<CollabNode> {
  source: string | CollabNode;
  target: string | CollabNode;
  type: 'author-paper';
  paperid: string;
  author_position: string;
  value: number;
}

interface AuthorAuthorLink extends d3.SimulationLinkDatum<AuthorNode> {
  source: string | AuthorNode;
  target: string | AuthorNode;
  type: 'author-author';
  collaboration_count: number;
  paper_ids: string[];
}

type CollabLink = AuthorPaperLink | AuthorAuthorLink;

const NetworkGraphs: React.FC = () => {
  const navigate = useNavigate();
  
  // State management for network configurations, supporting dynamic adjustments
  const [baseNetworkConfig, setBaseNetworkConfig] = useState<NetworkConfig>({
    title: "Paper Citation Network",
    maxNodes: 600,
    enableZoom: true
  });

  const [authorCollabConfig, setAuthorCollabConfig] = useState<NetworkConfig>({
    title: "Author Collaboration Network",
    maxNodes: 800,
    enableZoom: true
  });

  // Methods to adjust network configurations
  const updateBaseNetworkConfig = (config: Partial<NetworkConfig>) => {
    setBaseNetworkConfig(prev => ({ ...prev, ...config }));
  };

  const updateAuthorNetworkConfig = (config: Partial<NetworkConfig>) => {
    setAuthorCollabConfig(prev => ({ ...prev, ...config }));
  };

  // Paper Citation Network - Tooltip configuration
  const paperNodeTooltip = (node: BaseNode) => `
    <div style="line-height: 1.6;">
      <strong>${node.name}</strong><br/>
      Paper ID: ${node.paperid}<br/>
      Publication Year: ${node.publish_year}<br/>
      Citation Count: ${node.citation_count} times<br/>
      Affiliation: ${node.institution}<br/>
      Institution ID: ${node.institutionid || 'I19772626'}
    </div>
  `;

  const paperLinkTooltip = (link: CitationLink) => {
    const source = typeof link.source === 'object' ? link.source : { name: 'Unknown' };
    const target = typeof link.target === 'object' ? link.target : { name: 'Unknown' };
    
    return `
      <div style="line-height: 1.6;">
        <strong>Citation Relationship</strong><br/>
        Citing Paper: ${(source as BaseNode).name}<br/>
        Cited Paper: ${(target as BaseNode).name}<br/>
        Citing Year: ${link.citing_year}<br/>
        Cited Year: ${link.cited_year}<br/>
        Year Difference: ${link.year_diff} years<br/>
        Weight: ${link.value}
      </div>
    `;
  };

  // Author Collaboration Network - Tooltip configuration
  const authorNodeTooltip = (node: CollabNode) => {
    if (node.type === 'author') {
      return `
        <div style="line-height: 1.6;">
          <strong>Author Node</strong><br/>
          Author ID: ${node.authorid}<br/>
          Name: ${node.name}<br/>
          Institution ID: ${node.institutionid}<br/>
          Participated Papers: ${node.paper_count}<br/>
        </div>
      `;
    } else {
      return `
        <div style="line-height: 1.6;">
          <strong>Paper Node</strong><br/>
          Paper ID: ${node.paperid}<br/>
          Name: ${node.name}<br/>
          Author Count: ${node.author_count}
        </div>
      `;
    }
  };

  const authorLinkTooltip = (link: CollabLink) => {
    const source = typeof link.source === 'object' ? link.source : { name: 'Unknown' };
    const target = typeof link.target === 'object' ? link.target : { name: 'Unknown' };
    
    if (link.type === 'author-author') {
      return `
        <div style="line-height: 1.6;">
          <strong>Collaboration Link</strong><br/>
          Authors: ${(source as AuthorNode).name} & ${(target as AuthorNode).name}<br/>
          Collaboration Count: ${link.collaboration_count} times<br/>
          Shared Papers: ${link.paper_ids.length}
        </div>
      `;
    } else {
      return `
        <div style="line-height: 1.6;">
          <strong>Author-Paper Link</strong><br/>
          Author: ${(source as AuthorNode).name}<br/>
          Paper: ${(target as PaperNode).name}<br/>
          Paper ID: ${link.paperid}<br/>
          Author Position: ${link.author_position}<br/>
          Weight: ${link.value}
        </div>
      `;
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Page title and back button */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: 30,
        borderBottom: "1px solid #eee",
        paddingBottom: 15
      }}>
        <h1 style={{ color: "#2c3e50", fontSize: "1.8rem" }}>
          Yeshiva University Research Networks
        </h1>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: "10px 20px",
            backgroundColor: "#3498db",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            transition: "background-color 0.2s"
          }}
          onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#2980b9"}
          onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#3498db"}
        >
          Back to First Page
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: "10px 20px",
            backgroundColor: "#3498db",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            transition: "background-color 0.2s"
          }}
          onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#2980b9"}
          onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#3498db"}
        >
          Move to Research Dashboard
        </button>

      </div>

      {/* Network control area - stacked vertically */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 15,
        marginBottom: 20
      }}>
        {/* First network control */}
        <div style={{
          backgroundColor: "#f8f9fa",
          padding: 15,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 15
        }}>
          <span style={{ fontWeight: 500 }}>{baseNetworkConfig.title} Controls:</span>
          <div>
            <label style={{ marginRight: 8 }}>Max Nodes:</label>
            <input
              type="number"
              value={baseNetworkConfig.maxNodes}
              onChange={(e) => updateBaseNetworkConfig({
                maxNodes: Math.max(10, Math.min(1000, parseInt(e.target.value) || 600))
              })}
              min={10}
              max={1000}
              style={{ width: 80, padding: 4 }}
            />
          </div>
          <div>
            <label style={{ marginRight: 8 }}>Enable Zoom:</label>
            <input
              type="checkbox"
              checked={baseNetworkConfig.enableZoom}
              onChange={(e) => updateBaseNetworkConfig({ enableZoom: e.target.checked })}
            />
          </div>
        </div>

        {/* Second network control */}
        <div style={{
          backgroundColor: "#f8f9fa",
          padding: 15,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 15
        }}>
          <span style={{ fontWeight: 500 }}>{authorCollabConfig.title} Controls:</span>
          <div>
            <label style={{ marginRight: 8 }}>Max Nodes:</label>
            <input
              type="number"
              value={authorCollabConfig.maxNodes}
              onChange={(e) => updateAuthorNetworkConfig({
                maxNodes: Math.max(10, Math.min(1000, parseInt(e.target.value) || 800))
              })}
              min={10}
              max={1000}
              style={{ width: 80, padding: 4 }}
            />
          </div>
          <div>
            <label style={{ marginRight: 8 }}>Enable Zoom:</label>
            <input
              type="checkbox"
              checked={authorCollabConfig.enableZoom}
              onChange={(e) => updateAuthorNetworkConfig({ enableZoom: e.target.checked })}
            />
          </div>
        </div>
      </div>

      {/* Network graph containers - stacked vertically */}
      <div style={{ 
        display: "flex",
        flexDirection: "column",
        gap: 30,
        marginBottom: 40
      }}>
        {/* Top: Paper Citation Network */}
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "10px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          padding: 20
        }}>
          <BaseNetwork
            title={baseNetworkConfig.title}
            nodeTooltip={paperNodeTooltip}
            linkTooltip={paperLinkTooltip}
            maxNodes={baseNetworkConfig.maxNodes}
            enableZoom={baseNetworkConfig.enableZoom}
          />
        </div>

        {/* Bottom: Author Collaboration Network */}
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "10px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          padding: 20
        }}>
          <AuthorCollabNetwork
            title={authorCollabConfig.title}
            nodeTooltip={authorNodeTooltip}
            linkTooltip={authorLinkTooltip}
            maxNodes={authorCollabConfig.maxNodes}
            enableZoom={authorCollabConfig.enableZoom}
          />
        </div>
      </div>

      {/* Page instructions */}
      <div style={{
        textAlign: "left",
        color: "#666",
        fontSize: "14px",
        lineHeight: 1.8,
        marginTop: 20,
        padding: 15,
        backgroundColor: "#f8f9fa",
        borderRadius: "8px"
      }}>
        <h3 style={{ color: "#2c3e50", marginBottom: 10 }}>The following solutions were primarily adopted to mitigate the scalability issues arising from large-scale data:</h3>
        <div>• Data Filtering and Cleaning: During the data loading phase, raw data is rigorously filtered, retaining only valid records containing complete core fields (such as paper ID, author ID, and institution ID) to reduce the impact of invalid data on subsequent processing.</div>
        <div>• Node Count Limitation: The total number of nodes displayed is controlled by setting the `maxNodes` parameter, and nodes are sorted by importance , prioritizing the display of more representative nodes to avoid visual clutter and performance overload.</div>
        <div>• Relationship Pruning:  After limiting the number of nodes, only relationships where both ends of the node list are displayed are retained, automatically filtering out invalid links and significantly reducing the number of elements requiring rendering.</div>
        <div>• Force-Directed Layout Optimization: Force-directed parameters (such as distance and strength) are dynamically adjusted based on node type and relationship strength, and a reasonable collision detection radius is set to ensure clear layout while reducing computational complexity.</div>
      </div>
    </div>
  );
};

export default NetworkGraphs;