import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { csvParse } from 'd3-dsv';
import { useNavigate } from 'react-router-dom';
import type { Simulation } from 'd3-force';

// Type definition extensions
interface EnhancedNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  institution: string;
  publish_year: number;
  citation_count: number;
  paperid: string;
  topic: string;
  impact_score: number;
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

interface CsvCitationData {
  citing_paperid: string;
  cited_paperid: string;
  year: string;
  ref_year: string;
  year_diff: string;
}

interface EnhancedCitationNetworkProps {
  maxNodes?: number;
  enableZoom?: boolean;
  nodeTooltip?: (node: EnhancedNode) => string;
  linkTooltip?: (link: EnhancedLink) => string;
  showNodeLabels?: boolean;
  labelProperty?: keyof EnhancedNode;
}

const DEFAULT_CONFIG = {
  maxNodes: 500,
  enableZoom: true,
  showNodeLabels: true,
  labelProperty: 'name' as keyof EnhancedNode
};

// Node tooltip information identical to EnhancedCitationNetwork
const defaultNodeTooltip = (node: EnhancedNode): string => {
  return `
    <div style="line-height: 1.8; padding: 8px 0; min-width: 220px;">
      <strong style="font-size: 14px; color: #2c3e50;">${node.name}</strong><br>
      <span style="color: #7f8c8d;">Publication Year:</span> ${node.publish_year}<br>
      <span style="color: #7f8c8d;">Citation Count:</span> ${node.citation_count} times<br>
      <span style="color: #7f8c8d;">Research Topic:</span> ${node.topic}<br>
      <span style="color: #7f8c8d;">Impact Score:</span> ${node.impact_score.toFixed(2)}<br>
      <span style="color: #7f8c8d;">Institution:</span> ${node.institution}<br>
      <span style="color: #7f8c8d;">Paper ID:</span> <span style="font-family: monospace; font-size: 11px;">${node.paperid}</span>
    </div>
  `;
};

// Link tooltip information identical to EnhancedCitationNetwork
const defaultLinkTooltip = (link: EnhancedLink): string => {
  const source = typeof link.source === 'object' ? link.source : null;
  const target = typeof link.target === 'object' ? link.target : null;
  const sourceName = source?.name || (typeof link.source === 'string' ? link.source.slice(-6) : 'Unknown');
  const targetName = target?.name || (typeof link.target === 'string' ? link.target.slice(-6) : 'Unknown');
  
  const citationTypeMap: Record<string, string> = {
    'positive': 'Positive Citation',
    'negative': 'Negative Citation',
    'neutral': 'Neutral Citation',
    'method': 'Method Citation',
    'result': 'Result Citation'
  };
  
  return `
    <div style="line-height: 1.8; padding: 8px 0; min-width: 220px;">
      <strong style="font-size: 14px; color: #2c3e50;">Citation Relationship Details</strong><br>
      <span style="color: #7f8c8d;">Citing Paper:</span> ${sourceName}<br>
      <span style="color: #7f8c8d;">Cited Paper:</span> ${targetName}<br>
      <span style="color: #7f8c8d;">Citation Year:</span> ${link.citing_year} → ${link.cited_year}<br>
      <span style="color: #7f8c8d;">Year Difference:</span> ${link.year_diff} years<br>
      <span style="color: #7f8c8d;">Citation Type:</span> ${citationTypeMap[link.citation_type] || link.citation_type}<br>
      <span style="color: #7f8c8d;">Relevance:</span> ${link.relevance.toFixed(2)}
    </div>
  `;
};

const EnhancedCitationNetworkV1: React.FC<EnhancedCitationNetworkProps> = ({
  maxNodes = DEFAULT_CONFIG.maxNodes,
  enableZoom = DEFAULT_CONFIG.enableZoom,
  nodeTooltip = defaultNodeTooltip,
  linkTooltip = defaultLinkTooltip,
  showNodeLabels = DEFAULT_CONFIG.showNodeLabels,
  labelProperty = DEFAULT_CONFIG.labelProperty
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<EnhancedNode, EnhancedLink> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{ nodes: EnhancedNode[], links: EnhancedLink[] }>({
    nodes: [],
    links: []
  });
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Data loading logic
  useEffect(() => {
    const fetchAndParseCsv = async () => {
      setLoading(true);
      setError("");
      try {
        const csvResponse = await fetch('/refs_yeshiva_cs_20_25.csv');
        if (!csvResponse.ok) {
          throw new Error(`HTTP error! Status: ${csvResponse.status} - ${csvResponse.statusText}`);
        }

        const csvText = await csvResponse.text();
        const rawData = csvParse(csvText) as unknown as CsvCitationData[];
        console.log('Raw CSV data count:', rawData.length);

        const validCitationData = rawData.filter(row => {
          const citingId = row.citing_paperid?.trim();
          const citedId = row.cited_paperid?.trim();
          const citingYear = parseInt(row.year?.trim() || '', 10);
          const citedYear = parseInt(row.ref_year?.trim() || '', 10);
          const yearDiff = parseInt(row.year_diff?.trim() || '0', 10);

          if (!citingId || !citedId) return false;
          if (isNaN(citingYear) || isNaN(citedYear) || citingYear < 2020 || citingYear > 2025 || citedYear < 2020 || citedYear > 2025) return false;
          if (isNaN(yearDiff) || yearDiff < -5 || yearDiff > 10) return false;
          return true;
        });
        console.log('Filtered valid data count:', validCitationData.length);

        const paperIds = new Set<string>();
        validCitationData.forEach(row => {
          paperIds.add(row.citing_paperid.trim());
          paperIds.add(row.cited_paperid.trim());
        });
        console.log('Extracted unique paper count:', paperIds.size);

        const nodes: EnhancedNode[] = Array.from(paperIds).map(id => {
          const citationCount = validCitationData.filter(
            row => row.cited_paperid.trim() === id
          ).length;

          const citingRecord = validCitationData.find(row => row.citing_paperid.trim() === id);
          const citedRecord = validCitationData.find(row => row.cited_paperid.trim() === id);
          const publishYear = citingRecord
            ? parseInt(citingRecord.year.trim(), 10)
            : citedRecord ? parseInt(citedRecord.ref_year.trim(), 10) : 2020;

          return {
            id: id.trim(),
            name: `Paper_${id.trim().slice(-6)}`,
            institution: "Yeshiva University",
            publish_year: publishYear,
            citation_count: citationCount,
            paperid: id.trim(),
            topic: 'computer science',
            impact_score: Math.round((citationCount * 0.8 + 0.2) * 100) / 100
          };
        });
        console.log('Created node count:', nodes.length);

        const links: EnhancedLink[] = validCitationData.map(row => ({
          source: row.citing_paperid.trim(),
          target: row.cited_paperid.trim(),
          value: 1,
          citing_year: parseInt(row.year.trim(), 10),
          cited_year: parseInt(row.ref_year.trim(), 10),
          year_diff: parseInt(row.year_diff.trim(), 10),
          citation_type: 'neutral',
          relevance: 1.0
        }));

        const sortedNodes = [...nodes].sort((a, b) => b.citation_count - a.citation_count);
        const limitedNodes = sortedNodes.slice(0, Math.min(maxNodes, sortedNodes.length));
        const finalNodes = limitedNodes.length > 0 ? limitedNodes : sortedNodes.slice(0, 1);
        const limitedNodeIds = new Set(finalNodes.map(node => node.id));

        const filteredLinks = links.filter(link => {
          const sourceId = typeof link.source === 'object' ? (link.source as EnhancedNode).id : link.source;
          const targetId = typeof link.target === 'object' ? (link.target as EnhancedNode).id : link.target;
          return limitedNodeIds.has(sourceId.toString()) && limitedNodeIds.has(targetId.toString());
        });

        console.log('Final displayed node count:', finalNodes.length);
        console.log('Final displayed link count:', filteredLinks.length);
        setData({ nodes: finalNodes, links: filteredLinks });

      } catch (err) {
        setError(`Failed to load data: ${(err as Error).message}
          Please check: 1. Whether the CSV file path is correct; 2. Whether the file format meets the requirements (contains citing_paperid, cited_paperid, year, ref_year, year_diff fields)`);
        console.error('Data loading error:', err);
        setData({ nodes: [], links: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchAndParseCsv();
  }, [maxNodes]);

  // Core fix: Tooltip positioning and display logic (ensure not blocked, stable display)
  const showTooltip = (event: MouseEvent, content: string) => {
    if (!tooltipRef.current) return;
    
    // Set content
    tooltipRef.current.innerHTML = content;
    
    // Calculate safe position (avoid exceeding viewport)
    const tooltip = tooltipRef.current;
    const tooltipWidth = tooltip.offsetWidth || 220;
    const tooltipHeight = tooltip.offsetHeight || 150;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Horizontal positioning: prefer right, left if right is insufficient
    let left = event.clientX + 15;
    if (left + tooltipWidth > windowWidth) {
      left = event.clientX - tooltipWidth - 15;
    }
    left = Math.max(left, 10); // Minimum left margin
    
    // Vertical positioning: prefer top, bottom if top is insufficient
    let top = event.clientY - 15;
    if (top - tooltipHeight < 0) {
      top = event.clientY + 15;
    }
    top = Math.max(top, 10); // Minimum top margin
    
    // Apply styles and display
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';
  };

  const hideTooltip = () => {
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
      tooltipRef.current.style.transform = 'translateY(5px)';
    }
  };

  // Drawing and interaction logic (fix tooltip related issues)
  useEffect(() => {
    if (!svgRef.current || loading || data.nodes.length === 0 || data.links.length === 0) return;
  
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
  
    const width = 1000;
    const height = 800;
    const bigCircleRadius = 300;
    const centerX = width / 2;
    const centerY = height / 2;
  
    // Group by year
    const yearGroups = d3.group(data.nodes, (node) => node.publish_year);
    const yearOrder = Array.from(yearGroups.keys()).sort((a, b) => a - b) as number[];
  
    // Calculate year node counts and radii
    const yearNodeCounts = new Map<number, number>();
    yearOrder.forEach(year => yearNodeCounts.set(year, yearGroups.get(year)?.length || 0));
    const maxNodeCount = Math.max(...Array.from(yearNodeCounts.values()), 1);
    const minSmallRadius = 40;
    const maxSmallRadius = 100;
    
    const yearRadiusMap = new Map<number, number>();
    yearOrder.forEach(year => {
      const count = yearNodeCounts.get(year)!;
      yearRadiusMap.set(year, minSmallRadius + (maxSmallRadius - minSmallRadius) * (count / maxNodeCount));
    });
  
    // Calculate year center positions (avoid overlap)
    const yearCenterMap = new Map<number, { x: number; y: number }>();
    const placedCenters: Array<{x: number; y: number; r: number}> = [];
    
    yearOrder.forEach((year) => {
      const smallRadius = yearRadiusMap.get(year)!;
      let attempts = 0;
      let x = 0;
      let y = 0;
      let validPosition = false;
  
      while (attempts < 1000 && !validPosition) {
        attempts++;
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * (bigCircleRadius - smallRadius - 20);
        x = centerX + distance * Math.cos(angle);
        y = centerY + distance * Math.sin(angle);
  
        validPosition = placedCenters.every(placed => {
          const distanceBetween = Math.sqrt(Math.pow(x - placed.x, 2) + Math.pow(y - placed.y, 2));
          return distanceBetween >= (smallRadius + placed.r + 10);
        });
      }
  
      if (validPosition) {
        yearCenterMap.set(year, { x, y });
        placedCenters.push({ x, y, r: smallRadius });
      } else {
        const angle = (yearOrder.indexOf(year) / yearOrder.length) * 2 * Math.PI;
        const distance = bigCircleRadius - smallRadius - 20;
        x = centerX + distance * Math.cos(angle);
        y = centerY + distance * Math.sin(angle);
        yearCenterMap.set(year, { x, y });
        placedCenters.push({ x, y, r: smallRadius });
      }
    });
  
    // Calculate initial node positions
    const nodePositionMap = new Map<string, { x: number; y: number }>();
    yearOrder.forEach(year => {
      const yearCenter = yearCenterMap.get(year)!;
      const yearRadius = yearRadiusMap.get(year)!;
      const yearNodes = yearGroups.get(year)!;
      const nodeCount = yearNodes.length;
      
      yearNodes.forEach((node, index) => {
        const nodeDistance = yearRadius - 15;
        const angle = (index / nodeCount) * 2 * Math.PI + Math.random() * 0.5;
        const x = yearCenter.x + nodeDistance * Math.cos(angle);
        const y = yearCenter.y + nodeDistance * Math.sin(angle);
        nodePositionMap.set(node.id, { x, y });
      });
    });
  
    // Create SVG container group
    const g = svg.append('g')
      .attr('class', 'network-container')
      .attr('transform', `translate(0, 0)`);
  
    // Draw outer large circle
    g.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', bigCircleRadius)
      .attr('fill', 'none')
      .attr('stroke', '#333')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 2);
  
    // Draw year circles and labels
    yearOrder.forEach((year, index) => {
      const center = yearCenterMap.get(year)!;
      const radius = yearRadiusMap.get(year)!;
      
      g.append('circle')
        .attr('cx', center.x)
        .attr('cy', center.y)
        .attr('r', radius)
        .attr('fill', 'none')
        .attr('stroke', d3.schemeCategory10[index % 10])
        .attr('stroke-opacity', 0.7)
        .attr('stroke-width', 2);
      
      g.append('text')
        .attr('x', center.x)
        .attr('y', center.y - radius - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', 14)
        .attr('font-weight', 600)
        .attr('fill', d3.schemeCategory10[index % 10])
        .text(`Year ${year}`);
    });
  
    // Filter valid links and add path information
    const validLinks = data.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as EnhancedNode).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as EnhancedNode).id : link.target;
      return nodePositionMap.has(sourceId.toString()) && nodePositionMap.has(targetId.toString());
    });
  
    const linkDataWithPaths = validLinks.map(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as EnhancedNode).id : link.source.toString();
      const targetId = typeof link.target === 'object' ? (link.target as EnhancedNode).id : link.target.toString();
      const sourcePos = nodePositionMap.get(sourceId)!;
      const targetPos = nodePositionMap.get(targetId)!;
      return { ...link, path: [sourcePos, targetPos], sourceId, targetId };
    });
  
    // Link generator
    const linkGenerator = d3.line<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveNatural);
  
    // Link color scale
    const citationTypeColor = d3.scaleOrdinal<string, string>()
      .domain(['neutral', 'positive', 'negative', 'method', 'result'])
      .range(['#3498db', '#27ae60', '#e74c3c', '#f39c12', '#9b59b6']);

    const yearDiffColor = d3.scaleSequential()
      .domain([-5, 10])
      .interpolator(d3.interpolateRainbow);

    // Draw links (fix tooltip interaction)
    const links = g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(linkDataWithPaths)
      .enter()
      .append('path')
      .attr('d', d => linkGenerator(d.path))
      .attr('fill', 'none')
      .attr('stroke', d => {
        return ['positive', 'negative'].includes(d.citation_type) 
          ? citationTypeColor(d.citation_type) 
          : yearDiffColor(d.year_diff);
      })
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.value || 1) * 1.2)
      .attr('cursor', 'help')
      // Fix: Use correct event binding
      .on('mouseover', (event: MouseEvent, d: EnhancedLink) => {
        // Highlight link
        d3.select(event.currentTarget)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', d => Math.sqrt(d.value || 1) * 2)
          .attr('stroke', '#000');
        
        // Highlight associated nodes
        g.selectAll('.node-circle')
          .filter(node => node.id === d.sourceId || node.id === d.targetId)
          .attr('stroke', '#000')
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 1);

        // Show link tooltip
        showTooltip(event, linkTooltip(d));
      })
      .on('mouseout', (event: MouseEvent, d: EnhancedLink) => {
        // Restore link style
        d3.select(event.currentTarget)
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', d => Math.sqrt(d.value || 1) * 1.2)
          .attr('stroke', d => {
            return ['positive', 'negative'].includes(d.citation_type) 
              ? citationTypeColor(d.citation_type) 
              : yearDiffColor(d.year_diff);
          });
        
        // Restore node style
        if (!highlightedId) {
          g.selectAll('.node-circle')
            .filter(node => node.id === d.sourceId || node.id === d.targetId)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.8);
        }

        // Hide tooltip
        hideTooltip();
      });
  
    // Create node groups (manage nodes and labels uniformly)
    const nodeGroups = g.append('g')
      .attr('class', 'node-groups')
      .selectAll('.node-group')
      .data(data.nodes.filter(node => nodePositionMap.has(node.id)))
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', d => {
        const pos = nodePositionMap.get(d.id)!;
        return `translate(${pos.x}, ${pos.y})`;
      });
  
    // Draw nodes (add explicit class name for easy selection)
    const nodes = nodeGroups.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => Math.max(3, Math.log(d.citation_count + 1) * 2))
      .attr('fill', d => {
        const yearIndex = yearOrder.indexOf(d.publish_year);
        return d3.schemeCategory10[yearIndex % 10];
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.8)
      .attr('cursor', 'help')
      // Fix: Node tooltip interaction
      .on('mouseover', (event: MouseEvent, d: EnhancedNode) => {
        setHighlightedId(d.id);
        
        // Highlight current node
        d3.select(event.currentTarget)
          .attr('stroke', '#3498db')
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 1)
          .attr('r', d => Math.max(3, Math.log(d.citation_count + 1) * 2) + 2);
        
        // Highlight associated links
        links
          .filter(link => link.sourceId === d.id || link.targetId === d.id)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', l => Math.sqrt(l.value || 1) * 2)
          .attr('stroke', '#000');
        
        // Highlight associated nodes
        const connectedNodeIds = new Set<string>();
        linkDataWithPaths.forEach(link => {
          if (link.sourceId === d.id) connectedNodeIds.add(link.targetId);
          if (link.targetId === d.id) connectedNodeIds.add(link.sourceId);
        });
        
        g.selectAll('.node-circle')
          .filter(node => connectedNodeIds.has(node.id))
          .attr('stroke', '#3498db')
          .attr('stroke-width', 2.5)
          .attr('stroke-opacity', 1);

        // Show node label
        nodeGroups.filter(n => n.id === d.id)
          .select('.node-label')
          .style('opacity', 1);

        // Show node tooltip
        showTooltip(event, nodeTooltip(d));
      })
      .on('mouseout', (event: MouseEvent, d: EnhancedNode) => {
        setHighlightedId(null);
        
        // Restore node style
        d3.select(event.currentTarget)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .attr('stroke-opacity', 0.8)
          .attr('r', d => Math.max(3, Math.log(d.citation_count + 1) * 2));
        
        // Restore link style
        links
          .filter(link => link.sourceId === d.id || link.targetId === d.id)
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', l => Math.sqrt(l.value || 1) * 1.2)
          .attr('stroke', l => {
            return ['positive', 'negative'].includes(l.citation_type) 
              ? citationTypeColor(l.citation_type) 
              : yearDiffColor(l.year_diff);
          });
        
        // Restore associated node style
        const connectedNodeIds = new Set<string>();
        linkDataWithPaths.forEach(link => {
          if (link.sourceId === d.id) connectedNodeIds.add(link.targetId);
          if (link.targetId === d.id) connectedNodeIds.add(link.sourceId);
        });
        
        g.selectAll('.node-circle')
          .filter(node => connectedNodeIds.has(node.id))
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .attr('stroke-opacity', 0.8);

        // Restore label display state
        if (!showNodeLabels) {
          nodeGroups.filter(n => n.id === d.id)
            .select('.node-label')
            .style('opacity', 0);
        }

        // Hide tooltip
        hideTooltip();
      })
      .call(d3.drag<SVGCircleElement, EnhancedNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      );

    // Add node labels
    nodeGroups.append('text')
      .attr('class', 'node-label')
      .attr('dx', d => Math.max(3, Math.log(d.citation_count + 1) * 2) + 5)
      .attr('dy', '.3em')
      .attr('font-size', 10)
      .attr('fill', '#333')
      .attr('pointer-events', 'none')
      // .attr('opacity', showNodeLabels ? 0.7 : 0)
      .attr('opacity', 0) 
      .text(d => {
        const value = d[labelProperty];
        return typeof value === 'number' ? value.toString() : value;
      });

    // Drag event handlers
    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, EnhancedNode, unknown>, d: EnhancedNode) {
      if (!event.active && simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart();
      }
      d.fx = event.x + centerX;
      d.fy = event.y + centerY;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, EnhancedNode, unknown>, d: EnhancedNode) {
      d.fx = event.x + centerX;
      d.fy = event.y + centerY;
      nodePositionMap.set(d.id, { x: d.fx, y: d.fy });
      
      // Update node and label position
      d3.select(event.currentTarget.parentNode)
        .attr('transform', `translate(${event.x}, ${event.y})`);
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, EnhancedNode, unknown>) {
      if (!event.active && simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
      const d = event.subject as EnhancedNode;
      d.fx = null;
      d.fy = null;
    }
  
    // Force-directed simulation
    const simulation = d3.forceSimulation<EnhancedNode, EnhancedLink>(data.nodes)
      .alphaDecay(0.01)
      .velocityDecay(0.7)
      .force('charge', d3.forceManyBody().strength(-100))
      .force('link', d3.forceLink(validLinks).id(d => d.id).distance(50))
      .force('center', d3.forceCenter(centerX, centerY))
      .force('r', d3.forceRadial((d) => {
        const year = d.publish_year;
        const yearCenter = yearCenterMap.get(year)!;
        const yearRadius = yearRadiusMap.get(year)!;
        const distanceFromYearCenter = Math.hypot(d.x! - yearCenter.x, d.y! - yearCenter.y);
        return Math.min(distanceFromYearCenter, yearRadius - 15);
      }, (d) => yearCenterMap.get(d.publish_year)!.x, (d) => yearCenterMap.get(d.publish_year)!.y)
      .strength(1.5))
      .force('collide', d3.forceCollide()
        .radius(d => 10 + Math.log(Math.max(d.citation_count, 1)))
        .iterations(3)
      )
      .stop();
  
    // Sync node positions during simulation updates
    simulation.on('tick', () => {
      nodeGroups.attr('transform', d => `translate(${d.x}, ${d.y})`);
    });

    simulationRef.current = simulation;
  
    // Zoom functionality
    if (enableZoom) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });
      svg.call(zoom);
    }

    // Cleanup function
    return () => {
      simulationRef.current?.stop();
    };
  
  }, [data, loading, enableZoom, nodeTooltip, linkTooltip, showNodeLabels, labelProperty]);

  // Loading and error states
  if (loading) {
    return (
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        fontSize: '16px',
        color: '#666'
      }}>
        Loading... (Parsing paper citation data)
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        color: 'red', 
        padding: '20px', 
        fontSize: '14px', 
        lineHeight: '1.6',
        position: 'absolute',
        top: '20px',
        left: '20px'
      }}>
        <strong>Loading failed:</strong><br />
        {error}
      </div>
    );
  }

  // Component rendering (fix tooltip styles, ensure visibility)
  return (
    <div style={{ position: 'relative', width: '100%', height: '800px', overflow: 'visible' }}>
      <svg 
        ref={svgRef} 
        width="100%" 
        height="100%" 
        style={{ 
          border: '1px solid #eee', 
          borderRadius: '4px', 
          backgroundColor: '#f9f9f9' 
        }}
      />
      
      {/* Fix: Enhanced tooltip styles to ensure visibility and prevent遮挡 */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed', // Changed to fixed positioning to avoid offset when scrolling
          background: 'rgba(255, 255, 255, 0.98)',
          color: '#333',
          padding: '10px 14px',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          transform: 'translateY(5px)',
          fontSize: '12px',
          zIndex: 9999, // Highest level to ensure visibility
          maxWidth: '280px',
          border: '1px solid #e0e0e0',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
};

export default EnhancedCitationNetworkV1;