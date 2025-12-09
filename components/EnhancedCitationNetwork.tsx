import React, { useEffect, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';
import bundle from 'd3-bundle';



interface EnhancedNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  publish_year: number | string;
  citation_count: number;
  institution: string;
  topic: string;
  impact_score: number;
}

interface EnhancedLink extends d3.SimulationLinkDatum<EnhancedNode>  {
  source: string;
  target: string;
  value: number;
  citing_year: number;
  cited_year: number;
  year_diff: number;
  citation_type: string;
  relevance: number;
}

// Component attribute type (receives apiUrl)
interface EnhancedCitationNetworkProps {
  apiUrl: string;
}

interface HierarchyData {
  id: string;
  name?: string;
  children?: (HierarchyData | EnhancedNode)[];
  parent?: string;
}

interface HierarchyNodeData {
  id: string;
  name?: string;
  children?: HierarchyNodeData[];
  // The unique attributes of paper nodes
  publish_year?: number | string;
  citation_count?: number;
  institution?: string;
  topic?: string;
  impact_score?: number;
  parent?: string;
}

const EnhancedCitationNetwork: React.FC<EnhancedCitationNetworkProps> = ({ apiUrl }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{ nodes: EnhancedNode[], links: EnhancedLink[] }>({
    nodes: [],
    links: []
  });

  const navigate = useNavigate();

  // 1. Load backend data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(apiUrl);
        const result = await response.json();
        
        if (result.error) {
          setError(result.error);
          return;
        }
        
        const MAX_NODES = 2000; // Adjust according to the actual scenario
        const validNodes = result.nodes
            .filter((node: EnhancedNode) => node.id)
            .slice(0, MAX_NODES); // Limit the maximum number of nodes


        const validLinks = result.links.filter((link: EnhancedLink) => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return validNodes.some((n: EnhancedNode) => n.id === sourceId) && validNodes.some((n: EnhancedNode) => n.id === targetId);
        });     
        // Filter out invalid nodes/edges (to avoid layout errors)
        // const validNodes = result.nodes.filter((node: EnhancedNode) => node.id);
        // const validLinks = result.links.filter((link: EnhancedLink) => 
        //   link.source && link.target && validNodes.some((n: EnhancedNode) => n.id === link.source) && validNodes.some((n: EnhancedNode) => n.id === link.target)
        // );
        
        setData({ nodes: validNodes, links: validLinks });
      } catch (err) {
        setError(`Data loading failed: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiUrl]);

  // 2. Draw layered edge bundling diagram
  useEffect(() => {
    if (!svgRef.current || loading || data.nodes.length === 0) return;

    // Clear previous drawings
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Configure canvas size
    const width = 1000;
    const height = 800;
    const radius = Math.min(width, height) / 2 - 100; // Circular radius

    // 3. Build hierarchical structure (root → year groups → paper nodes)
    // Group nodes by publication year
    const yearGroups = d3.group(data.nodes, (node) => node.publish_year);
    const yearOrder = Array.from(yearGroups.keys()).sort((a, b) => 
      typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
    );
    // 4. Build D3 hierarchical data structure
    const hierarchyData = {
      id: 'root',
      children: yearOrder.map((year) => ({
        id: `year_${year}`,
        name: `Year ${year}`,
        children: yearGroups.get(year)?.map((node) => ({ ...node, parent: `year_${year}` })) || []
      }))
    };

    // 4. Draw hierarchical layout (cluster layout)
    const root = d3.hierarchy<HierarchyNodeData>(hierarchyData);
    const clusterLayout = d3.cluster<HierarchyNodeData>()
      .size([2 * Math.PI, radius]) // Angle range（0~2π）、Radius range
      .separation((a, b) => (a.parent === b.parent ? 1.5 : 3) / a.depth); // Node spacing（Same group more dense）
    // Calculate node positions
    clusterLayout(root); 

    clusterLayout(root); // Calculate node positions

    // 5. Map node IDs to layout positions
    const nodePositionMap = new Map<string, { x: number; y: number }>();
    root.descendants().forEach((d) => {
      if (d.depth === 2) { // Only handle paper nodes (depth=0: root, 1: year group, 2: paper)
        // Convert polar coordinates to Cartesian coordinates (adapt to SVG canvas)
        // Add ! non-null assertion, telling TS d.x will have a value (clusterLayout has computed it)
        const x = width / 2 + radius * Math.cos(d.x! - Math.PI / 2);
        const y = height / 2 + radius * Math.sin(d.x! - Math.PI / 2);
        nodePositionMap.set(d.data.id, { x, y });
      }
    });

    // 6. Create drawing container
    const g = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`); // Canvas center

    // 7. Draw year group rings (background layer)
    yearOrder.forEach((year, index) => {
      const ringRadius = radius - (index * 50 + 30); // Different year group ring radii
      
      g.append('circle')
        .attr('r', ringRadius)
        .attr('fill', 'none')
        .attr('stroke', d3.schemeCategory10[index % 10])
        .attr('stroke-opacity', 0.2)
        .attr('stroke-width', 2);

      // Draw year group labels
      g.append('text')
        .attr('x', 0)
        .attr('y', -ringRadius - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', 14)
        .attr('font-weight', 600)
        .attr('fill', d3.schemeCategory10[index % 10])
        .text(`Year ${year}`);
    });

  
    // Edge binding generator
    // Modify duplicate variable names，Change validLinks to bundledValidLinks
    //8. Edge binding processing (complete revision)
    // Prepare edge data (only retain nodes with location mappings).
    const validLinks = data.links.filter((link: EnhancedLink) => 
      nodePositionMap.has(link.source) && nodePositionMap.has(link.target)
    );
    
    // Build edge paths (source → year group → root → target year group → target)
    const linkPaths = validLinks.map((link: EnhancedLink) => {
      const sourceNode = data.nodes.find((n: EnhancedNode) => n.id === link.source)!;
      const targetNode = data.nodes.find((n: EnhancedNode) => n.id === link.target)!;
      
      // Path: Paper node → Year group virtual node → Root node → Target year group virtual node → Target paper node
      return [
        nodePositionMap.get(link.source)!, // Source paper node
        { x: width / 2 + (radius - 50) * Math.cos(yearOrder.indexOf(sourceNode.publish_year) * 0.5), y: height / 2 + (radius - 50) * Math.sin(yearOrder.indexOf(sourceNode.publish_year) * 0.5) }, // 源年份组虚拟节点
        { x: width / 2, y: height / 2 }, // Root node (center)
        { x: width / 2 + (radius - 50) * Math.cos(yearOrder.indexOf(targetNode.publish_year) * 0.5), y: height / 2 + (radius - 50) * Math.sin(yearOrder.indexOf(targetNode.publish_year) * 0.5) }, // Target year group virtual node
        nodePositionMap.get(link.target)! // Target paper node
      ];
    });
    
    
    // Define the edge generator (explicit type)
    const linkGenerator = d3.line<{x: number; y: number}>()
      .x(d => d.x - width / 2)  // X coordinate relative to the center
      .y(d => d.y - height / 2) // Y coordinate relative to the center
      .curve(d3.curveBundle.beta(0.85)); // Use D3's built-in edge bundling curve
    
    // Generate bundled paths (ensure defined before drawing edges)
    const bundledPaths = linkPaths; // Use the path array directly, curve generator will handle bundling logic
    
    // 9. Draw bundled edges (now can access bundledPaths correctly)
    g.append('g')
      .selectAll('path')
      .data(bundledPaths)
      .enter()
      .append('path')
      .attr('d', linkGenerator)  // Apply generator to generate paths
      .attr('fill', 'none')
      .attr('stroke', (d, i) => {
        const link = validLinks[i];
        switch(link.citation_type) {
          case 'positive': return '#27ae60'; // Dark green (positive quote)
          case 'negative': return '#e74c3c'; // Dark red (negative quote)
          default: return '#3498db'; // Blue (neutral quote, original gray changed to blue for better visibility)
        }
      })
      .attr('stroke-opacity', (d, i) => {
        // Citation count determines edge opacity (more citations = more opaque)
        return Math.min(0.8, 0.3 + (validLinks[i].value / 10));
      })
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', (d, i) => Math.sqrt(validLinks[i].value) * 0.8);
    // 10. Draw paper nodes (ensure correct position mapping)
    const nodes = g.append('g')
      .selectAll('circle')
      .data(data.nodes.filter(node => nodePositionMap.has(node.id)))
      .enter()
      .append('circle')
      .attr('cx', (d) => nodePositionMap.get(d.id)!.x - width / 2)
      .attr('cy', (d) => nodePositionMap.get(d.id)!.y - height / 2)
      .attr('r', (d) => Math.max(3, Math.log(d.citation_count + 1) * 2)) // Citation count determines node size (more citations = larger node)
      .attr('fill', (d) => {
        const yearIndex = yearOrder.indexOf(d.publish_year);
        return d3.schemeCategory10[yearIndex % 10]; // Same year, same color
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.8)
      .call(d3.drag<SVGCircleElement, EnhancedNode>() // Node drag functionality
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('mouseover', (event, d) => {
        // Node hover highlight (same color as year group)
        d3.select(event.currentTarget)
          .attr('stroke', '#3498db')
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 1);
        
        // Show node tooltip
        if (tooltipRef.current) {
          tooltipRef.current.innerHTML = `
            <div style="line-height: 1.6;">
              <strong>${d.name}</strong><br>
              Year of publication: ${d.publish_year}<br>
              Citation count: ${d.citation_count} times<br>
              Topic: ${d.topic}<br>
              Impact factor: ${d.impact_score.toFixed(2)}<br>
              Institution: ${d.institution}
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
          .attr('stroke-width', 1.5)
          .attr('stroke-opacity', 0.8);
        
        if (tooltipRef.current) {
          tooltipRef.current.style.opacity = '0';
        }
      });

    // 11. Node drag logic (based on force simulation for layout assistance)
    const simulation = d3.forceSimulation<EnhancedNode, EnhancedLink>(data.nodes)
    .alphaDecay(0.02)        // Default is 0.0228, can lower to make layout smoother
    .velocityDecay(0.4) 
    .force('charge', d3.forceManyBody().strength(-150))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('link', d3.forceLink<EnhancedNode, EnhancedLink>(validLinks)
    .id(d => d.id)  
    .distance(100)
    )
    .stop();

    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, EnhancedNode, unknown>, d: EnhancedNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = nodePositionMap.get(d.id)!.x;
      d.fy = nodePositionMap.get(d.id)!.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, EnhancedNode, unknown>, d: EnhancedNode) {
      d.fx = event.x + width / 2; // Adaptation center coordinates
      d.fy = event.y + height / 2;
      nodePositionMap.set(d.id, { x: d.fx, y: d.fy });
      // Update node position: use sourceEvent to get the native DOM event for correct currentTarget
      d3.select(event.sourceEvent.currentTarget as SVGCircleElement)
        .attr('cx', event.x)
        .attr('cy', event.y);
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, EnhancedNode, unknown>) {
      if (!event.active) simulation.alphaTarget(0);
      (event.subject as any).fx = null;
      (event.subject as any).fy = null;
    }

    // 12. Zoom and pan functionality
    const zoom = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.3, 3]) // Zoom range
  .on('zoom', (event) => {
    // Correctly apply transform using event.transform
    g.attr('transform', `translate(${width / 2 + event.transform.x}, ${height / 2 + event.transform.y}) scale(${event.transform.k})`);
  });

svg.call(zoom);

  }, [data, loading]);

  // Loading/Error Status Rendering
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading the enhanced version reference network...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>Error loading the enhanced version reference network: {error}</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      
      {/* Drawing Container */}
      <svg
        ref={svgRef}
        width="100%"
        height={800}
        style={{
          border: '1px solid #eee',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      ></svg>

      {/* Visualization Description */}
      <div style={{ marginTop: 30, fontSize: 14, color: '#666', lineHeight: 1.8 }}>
        <h4>Visualization Description</h4>
        <ul>
          <li>Nodes are grouped by publication year in concentric circles, with edges bundled to reduce clutter</li>
          <li>Edges are bundled to reduce clutter, with different colors representing different types of citations</li>
          <li>Node size: Larger nodes indicate higher citation counts</li>
          <li>Edge colors: Green = positive citations, Red = negative citations, Blue = neutral citations</li>
          <li>Interaction: Supports zoom/pan (mouse wheel), node dragging, hover to view details</li>
        </ul>
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
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
        }}
      ></div>
    </div>
  );
};

export default EnhancedCitationNetwork;