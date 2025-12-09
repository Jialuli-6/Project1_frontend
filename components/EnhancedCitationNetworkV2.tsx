// EnhancedCitationNetworkV2.tsx - Load local CSV with field matching & error handling
import React, { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { csvParse } from 'd3-dsv';
import { useNavigate } from 'react-router-dom';

// Core interface definitions (matching CSV field structure)
interface EnhancedNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  publish_year: number | string;
  citation_count: number;
  institution: string;
  topic: string;
  impact_score: number;
  community?: number;
}

interface EnhancedLink extends d3.SimulationLinkDatum<EnhancedNode> {
  source: string | EnhancedNode;
  target: string | EnhancedNode;
  value: number;
  citing_year: number;
  cited_year: number;
  year_diff: number;
  citation_type: string;
  relevance: number;
}

// CSV raw data interface (strictly matching /refs_yeshiva_cs_20_25.csv fields)
interface CsvRawData {
  citing_paperid: string;
  cited_paperid: string;
  year: string;
  ref_year: string;
  year_diff: string;
}

interface EnhancedCitationNetworkProps {
  title: string;
}

const EnhancedCitationNetworkV2: React.FC<EnhancedCitationNetworkProps> = ({ title }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{ nodes: EnhancedNode[], links: EnhancedLink[] }>({
    nodes: [],
    links: []
  });
  const navigate = useNavigate();

  // Core logic for data loading and processing
  useEffect(() => {
    const loadAndProcessCsv = async () => {
      setLoading(true);
      setError('');
      const csvPath = '/refs_yeshiva_cs_20_25.csv';

      try {
        // 1. Load CSV from fixed path
        const response = await fetch(csvPath);
        
        // 2. Catch network errors and HTTP status exceptions
        if (!response.ok) {
          throw new Error(`File loading failed: ${response.status} - ${response.statusText}`);
        }

        const csvText = await response.text();
        if (!csvText.trim()) {
          throw new Error('CSV file content is empty');
        }

        // 3. Parse CSV and filter invalid rows
        const parsedRows = csvParse(csvText) as unknown as CsvRawData[];
        const validRows = parsedRows.filter(row => 
          row.citing_paperid?.trim() && 
          row.cited_paperid?.trim() && 
          row.year?.trim() && 
          row.ref_year?.trim()
        );

        if (validRows.length === 0) {
          throw new Error('No valid citation data rows');
        }

        // 4. Build nodes (deduplicate and merge citing and cited papers)
        const nodeMap = new Map<string, EnhancedNode>();
        validRows.forEach(row => {
          // Process citing nodes
          if (!nodeMap.has(row.citing_paperid)) {
            nodeMap.set(row.citing_paperid, {
              id: row.citing_paperid.trim(),
              name: `Paper_${row.citing_paperid.trim().slice(-6)}`, // Simplified name display
              publish_year: parseInt(row.year.trim(), 10) || row.year.trim(),
              citation_count: 0, // Initialize to 0, count later
              institution: 'Unknown',
              topic: 'Computer Science',
              impact_score: Math.random() * 5 // Simulated impact factor (can be read from extended fields in practice)
            });
          }

          // Process cited nodes
          if (!nodeMap.has(row.cited_paperid)) {
            nodeMap.set(row.cited_paperid, {
              id: row.cited_paperid.trim(),
              name: `Paper_${row.cited_paperid.trim().slice(-6)}`,
              publish_year: parseInt(row.ref_year.trim(), 10) || row.ref_year.trim(),
              citation_count: 0,
              institution: 'Unknown',
              topic: 'Computer Science',
              impact_score: Math.random() * 5
            });
          }

          // Count citation times
          const citedNode = nodeMap.get(row.cited_paperid);
          if (citedNode) {
            citedNode.citation_count += 1;
          }
        });

        // 5. Build link data
        const validLinks: EnhancedLink[] = validRows
          .map(row => {
            try {
              return {
                source: row.citing_paperid.trim(),
                target: row.cited_paperid.trim(),
                value: 1, // Each citation has a weight of 1, can be adjusted according to actual scenarios
                citing_year: parseInt(row.year.trim(), 10) || 0,
                cited_year: parseInt(row.ref_year.trim(), 10) || 0,
                year_diff: parseInt(row.year_diff.trim(), 10) || 0,
                citation_type: 'Direct', // Default to direct citation, can be extended
                relevance: Math.min(1, Math.max(0, 1 - Math.abs(parseInt(row.year_diff.trim(), 10) / 10)) )// Smaller year difference means higher relevance
              };
            } catch (err) {
              console.warn('Skipping invalid link data:', row, err);
              return null;
            }
          })
          .filter((link): link is EnhancedLink => link !== null)
          // Filter links with non-existent nodes
          .filter(link => 
            nodeMap.has(typeof link.source === 'string' ? link.source : link.source.id) &&
            nodeMap.has(typeof link.target === 'string' ? link.target : link.target.id)
          );

        // 6. Limit node quantity to optimize performance (keep original logic)
        const MAX_NODES = 1000;
        const limitedNodes = Array.from(nodeMap.values()).slice(0, MAX_NODES);
        const limitedLinks = validLinks.filter(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return limitedNodes.some(node => node.id === sourceId) && limitedNodes.some(node => node.id === targetId);
        });

        setData({ nodes: limitedNodes, links: limitedLinks });
        console.log(`Data processing completed: ${limitedNodes.length} nodes, ${limitedLinks.length} links`);

      } catch (err) {
        // 7. Unified error capture and prompt
        const errorMsg = err instanceof Error ? err.message : 'Unknown data loading error';
        setError(errorMsg);
        console.error('CSV data processing failed:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAndProcessCsv();
  }, []);

  // Community detection function (keep original logic)
  function detectCommunities(nodes: EnhancedNode[], links: EnhancedLink[]): Map<string, number> {
    const communities = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    
    nodes.forEach(node => adjacency.set(node.id, []));
    
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      adjacency.get(sourceId)?.push(targetId);
      adjacency.get(targetId)?.push(sourceId);
    });
    
    let communityId = 0;
    nodes.forEach(node => {
      if (!communities.has(node.id)) {
        const queue = [node.id];
        communities.set(node.id, communityId);
        
        while (queue.length > 0) {
          const current = queue.shift()!;
          adjacency.get(current)?.forEach(neighbor => {
            if (!communities.has(neighbor)) {
              communities.set(neighbor, communityId);
              queue.push(neighbor);
            }
          });
        }
        communityId++;
      }
    });
    
    return communities;
  }

  // Drawing logic (maintain original interaction experience)
  useEffect(() => {
    if (!svgRef.current || loading || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const width = 900;
    const height = 600;

    // Community detection
    const communities = detectCommunities(data.nodes, data.links);
    data.nodes.forEach(node => node.community = communities.get(node.id));

    // Community cohesion force
    // Fix type definition of community cohesion force function
function forceCommunity() {
  let nodes: EnhancedNode[] = [];
  let _strength = 0.1;

  // Specify the type of force function explicitly
  const force: d3.Force<EnhancedNode, undefined> = (alpha: number) => {
    for (const node of nodes) {
      const community = node.community;
      if (community === undefined) continue;

      let count = 0;
      let cx = 0;
      let cy = 0;
      for (const other of nodes) {
        if (other === node) continue;
        if (other.community === community) {
          cx += other.x!;
          cy += other.y!;
          count++;
        }
      }
      if (count > 0) {
        cx /= count;
        cy /= count;
        node.vx! += (cx - node.x!) * _strength * alpha;
        node.vy! += (cy - node.y!) * _strength * alpha;
      }
    }
  };

  force.initialize = (newNodes: EnhancedNode[]) => nodes = newNodes;
  
  // Add correct type for strength method
  (force as any).strength = function(value?: number) {
    if (arguments.length) {
      _strength = value!;
      return force;
    }
    return _strength;
  };

  return force;
}

// Fix type definition of boundary constraint force function
function forceBoundary(x1: number, y1: number, x2: number, y2: number) {
  let nodes: EnhancedNode[] = [];
  let _strength = 0.1;

  // Specify the type of force function explicitly
  const force: d3.Force<EnhancedNode, undefined> = (alpha: number) => {
    const s = _strength * alpha;
    for (const node of nodes) {
      if (node.x! < x1) node.vx! += (x1 - node.x!) * s;
      if (node.x! > x2) node.vx! -= (node.x! - x2) * s;
      if (node.y! < y1) node.vy! += (y1 - node.y!) * s;
      if (node.y! > y2) node.vy! -= (node.y! - y2) * s;
    }
  };

  force.initialize = (newNodes: EnhancedNode[]) => nodes = newNodes;
  
  // Add correct type for strength method
  (force as any).strength = function(value?: number) {
    if (arguments.length) {
      _strength = value!;
      return force;
    }
    return _strength;
  };

  return force;
}

    // Force-directed simulation
    const simulation = d3.forceSimulation<EnhancedNode, EnhancedLink>(data.nodes)
      .alphaDecay(0.02)
      .velocityDecay(0.4)
      .force('charge', d3.forceManyBody().strength(-300))
      .force('community', forceCommunity().strength(0.1))
      .force('link', d3.forceLink<EnhancedNode, EnhancedLink>(data.links)
        .id(d => d.id)
        .distance(d => 150 / Math.sqrt(d.value))
      )
      .force('boundary', forceBoundary(50, 50, width - 50, height - 50).strength(0.1))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Drawing container
    const g = svg.append('g');

    // Draw links
    g.append('g')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke-width', d => Math.sqrt(d.value))
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6);

    // Draw nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .enter().append('circle')
      .attr('r', d => Math.max(4, Math.log(d.citation_count + 1) * 2.5))
      .attr('fill', d => d3.schemeCategory10[(d.community || 0) % 10])
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .call(d3.drag<SVGCircleElement, EnhancedNode>()
        .on('start', (event) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        })
        .on('drag', (event) => {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        })
        .on('end', (event) => {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
        })
      )
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget)
          .attr('stroke', '#3498db')
          .attr('stroke-width', 3);
        
        if (tooltipRef.current) {
          tooltipRef.current.innerHTML = `
            <div style="line-height: 1.6;">
              <strong>${d.name}</strong><br>
              Publication Year: ${d.publish_year}<br>
              Citation Count: ${d.citation_count} times<br>
              Research Field: ${d.topic}<br>
              Impact Factor: ${d.impact_score.toFixed(2)}<br>
              Community ID: ${d.community}
            </div>
          `;
          tooltipRef.current.style.opacity = '1';
          tooltipRef.current.style.left = `${event.pageX + 10}px`;
          tooltipRef.current.style.top = `${event.pageY - 20}px`;
        }
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5);
        
        if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
      });

    // Simulation update
    simulation.on('tick', () => {
      g.selectAll('line')
        .attr('x1', d => (d.source as EnhancedNode).x!)
        .attr('y1', d => (d.source as EnhancedNode).y!)
        .attr('x2', d => (d.target as EnhancedNode).x!)
        .attr('y2', d => (d.target as EnhancedNode).y!);

      g.selectAll('circle')
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);
    });

    // Zoom and pan
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
    );

  }, [data, loading]);

  // Status rendering
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading citation network data...</div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#e74c3c' }}>
        <strong>Loading failed:</strong> {error}
        <div style={{ marginTop: 10, fontSize: '0.9em', color: '#7f8c8d' }}>
          Please check if the file exists at /refs_yeshiva_cs_20_25.csv path
        </div>
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#f39c12' }}>
        No valid node data to display
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ color: '#2c3e50', marginBottom: 15 }}>{title}</h2>
      <svg
        ref={svgRef}
        width="100%"
        height={600}
        style={{
          border: '1px solid #eee',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}
      ></svg>
      
      <div ref={tooltipRef} style={{
        position: 'absolute',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 0.2s',
        zIndex: 1000
      }}></div>
    </div>
  );
};

export default EnhancedCitationNetworkV2;