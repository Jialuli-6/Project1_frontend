import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { csvParse } from 'd3-dsv';
import type { Simulation } from 'd3-force';

// 1. Type definitions (strictly mapping CSV fields)
interface NetworkNode extends d3.SimulationNodeDatum {
  id: string; // Unique paper ID (citing_paperid or cited_paperid)
  name: string; // Simplified display name
  institution: string; // Fixed as Yeshiva University
  publish_year: number; // Publication year (citing paper uses year, cited paper uses ref_year)
  citation_count: number; // Citation count
  paperid: string; // Original paper ID (consistent with id for compatibility)
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode; // Citing paper ID (citing_paperid)
  target: string | NetworkNode; // Cited paper ID (cited_paperid)
  value: number; // Citation weight (default 1)
  citing_year: number; // Publication year of citing paper (CSV's year)
  cited_year: number; // Publication year of cited paper (CSV's ref_year)
  year_diff: number; // Year difference (CSV's year_diff)
}

interface RefCsvData {
  citing_paperid: string;
  cited_paperid: string;
  year: string;
  ref_year: string;
  year_diff: string;
}

interface NetworkProps {
  title: string;
  nodeTooltip: (node: NetworkNode) => string;
  linkTooltip: (link: NetworkLink) => string;
  maxNodes?: number;
  enableZoom?: boolean;
}

// Default configuration
const DEFAULT_CONFIG = {
  maxNodes: 500,
  enableZoom: true
};

const BaseNetwork: React.FC<NetworkProps> = ({
  title,
  nodeTooltip,
  linkTooltip,
  maxNodes = DEFAULT_CONFIG.maxNodes,
  enableZoom = DEFAULT_CONFIG.enableZoom
}) => {
  // DOM references
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);

  // State management
  const [data, setData] = useState<{ nodes: NetworkNode[]; links: NetworkLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayedNodes, setDisplayedNodes] = useState<NetworkNode[]>([]);
  const [displayedLinks, setDisplayedLinks] = useState<NetworkLink[]>([]);

  // 2. Load and preprocess CSV data (core modification: node and edge property mapping)
  useEffect(() => {
    const fetchAndParseData = async () => {
      setLoading(true);
      setError("");
      try {
        // Load CSV file
        const response = await fetch('/refs_yeshiva_cs_20_25.csv');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        const csvText = await response.text();
        const rawData = csvParse(csvText) as unknown as RefCsvData[];
        console.log('Raw CSV data volume:', rawData.length);

        // Filter valid data (validate core fields)
        const validData = rawData.filter(row => {
          const citingId = row.citing_paperid?.trim();
          const citedId = row.cited_paperid?.trim();
          const citingYear = parseInt(row.year?.trim() || '', 10);
          const citedYear = parseInt(row.ref_year?.trim() || '', 10);
          const yearDiff = parseInt(row.year_diff?.trim() || '0', 10);

          // Validation rules: IDs not empty, valid years (2020-2025), reasonable year difference
          if (!citingId || !citedId) {
            console.warn('Skipping row with missing citation relationship:', row);
            return false;
          }
          if (isNaN(citingYear) || isNaN(citedYear) || citingYear < 2020 || citingYear > 2025 || citedYear < 2020 || citedYear > 2025) {
            console.warn('Skipping row with invalid year:', row);
            return false;
          }
          if (isNaN(yearDiff) || yearDiff < -5 || yearDiff > 10) {
            console.warn('Skipping row with abnormal year difference:', row);
            return false;
          }
          return true;
        });
        console.log('Filtered valid data volume:', validData.length);

        // Extract all unique paper IDs (citing + cited)
        const paperIds = new Set<string>();
        validData.forEach(row => {
          paperIds.add(row.citing_paperid.trim());
          paperIds.add(row.cited_paperid.trim());
        });
        console.log('Extracted unique papers count:', paperIds.size);

        // 3. Generate node data (core modification: map CSV fields + fixed affiliation)
        const nodes: NetworkNode[] = Array.from(paperIds).map(id => {
          // Count citations (number of records citing this paper)
          const citationCount = validData.filter(row => row.cited_paperid.trim() === id).length;

          // Determine publication year: prefer year when paper is "citing", otherwise use "cited" ref_year, default to 2020
          const citingRecord = validData.find(row => row.citing_paperid.trim() === id);
          const citedRecord = validData.find(row => row.cited_paperid.trim() === id);
          const publishYear = citingRecord
            ? parseInt(citingRecord.year.trim(), 10)
            : citedRecord ? parseInt(citedRecord.ref_year.trim(), 10) : 2020;

          return {
            id: id.trim(),
            name: `Paper_${id.trim().slice(-6)}`, // Simplify display with last 6 characters
            institution: "Yeshiva University", // Fixed institution
            publish_year: publishYear,
            citation_count: citationCount,
            paperid: id.trim() // Consistent with id for compatibility
          };
        });
        console.log('Created nodes count:', nodes.length);

        // 4. Generate edge data (core modification: full CSV field mapping)
        const links: NetworkLink[] = validData.map(row => ({
          source: row.citing_paperid.trim(),
          target: row.cited_paperid.trim(),
          value: 1, // Each citation record has default weight 1
          citing_year: parseInt(row.year.trim(), 10),
          cited_year: parseInt(row.ref_year.trim(), 10),
          year_diff: parseInt(row.year_diff.trim(), 10)
        }));

        // Limit node count (prioritize papers with more citations)
        const sortedNodes = [...nodes].sort((a, b) => b.citation_count - a.citation_count);
        const limitedNodes = sortedNodes.slice(0, Math.min(maxNodes, sortedNodes.length));
        const finalNodes = limitedNodes.length > 0 ? limitedNodes : sortedNodes.slice(0, 1);
        const limitedNodeIds = new Set(finalNodes.map(node => node.id));

        // Filter edges (only keep edges where both nodes are in display list)
        const filteredLinks = links.filter(link => {
          const sourceId = typeof link.source === 'object' ? (link.source as NetworkNode).id : link.source;
          const targetId = typeof link.target === 'object' ? (link.target as NetworkNode).id : link.target;
          return limitedNodeIds.has(sourceId.toString()) && limitedNodeIds.has(targetId.toString());
        });

        console.log('Final displayed nodes count:', finalNodes.length);
        console.log('Final displayed edges count:', filteredLinks.length);
        setData({ nodes, links });
        setDisplayedNodes(finalNodes);
        setDisplayedLinks(filteredLinks);
      } catch (err) {
        setError(`Failed to load data: ${(err as Error).message}
          Please check: 1. CSV file path is correct; 2. File format meets requirements (contains citing_paperid, cited_paperid, year, ref_year, year_diff fields)`);
        setData({ nodes: [], links: [] });
        setDisplayedNodes([]);
        setDisplayedLinks([]);
        console.error('Data loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndParseData();
  }, [maxNodes]);

  // 5. Draw network graph (maintain original interaction logic, adapt to new types)
  useEffect(() => {
    if (!svgRef.current || displayedNodes.length === 0 || displayedLinks.length === 0 || loading) return;

    // Clear existing SVG content
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Basic configuration
    const width = 950;
    const height = 680;
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // 5.1 Zoom and pan functionality
    if (enableZoom) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
          svg.select(".network-container").attr("transform", event.transform);
        });
      svg.call(zoom);
    }

    // Create container group (centered display)
    const container = svg.append("g")
      .attr("class", "network-container")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // 5.2 Force-directed layout simulation
    const linkForce = d3.forceLink<NetworkNode, NetworkLink>(displayedLinks)
      .id((node) => node.id)
      .distance((link) => 120 + (5 - (link.value || 1)) * 10)
      .strength((link) => Math.min(0.4, (link.value || 1) / 5));

    const collideForce = d3.forceCollide()
      .radius((node) => {
        const safeCount = Math.max(node.citation_count, 1);
        return 15 + Math.log(safeCount) * 2; // Node size positively correlates with citation count
      })
      .iterations(3);

    const chargeForce = d3.forceManyBody()
      .strength(-180)
      .distanceMax(250);

    const simulation = d3.forceSimulation<NetworkNode, NetworkLink>(displayedNodes)
      .force("link", linkForce)
      .force("charge", chargeForce)
      .force("center", d3.forceCenter(0, 0))
      .force("collide", collideForce)
      .alphaDecay(0.01)
      .velocityDecay(0.7);

    simulationRef.current = simulation;

    // 5.3 Draw edges
    const links = container.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(displayedLinks)
      .enter()
      .append("line")
      .attr("stroke", "#666")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (link) => Math.sqrt(link.value || 1) * 1.2)
      .attr("stroke-linecap", "round");

    // 5.4 Draw nodes
    const nodes = container.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(displayedNodes)
      .enter()
      .append("circle")
      .attr("r", (node) => {
        const safeCount = Math.max(node.citation_count, 1);
        return Math.max(8, Math.log(safeCount) * 2.5);
      })
      .attr("fill", (node) => color(node.id))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("cursor", "move")
      .call(
        d3.drag<SVGCircleElement, NetworkNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.5).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // 5.5 Draw node labels
    const labels = container.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(displayedNodes)
      .enter()
      .append("text")
      .text((node) => node.name)
      .attr("font-size", 10)
      .attr("dx", 12)
      .attr("dy", 4)
      .attr("fill", "#333")
      .attr("pointer-events", "none")
      .attr("text-anchor", "start");

    // 5.6 Tooltip interaction
    nodes.on("mouseover", function (event, node) {
      d3.select(this)
        .attr("stroke", "#1a73e8")
        .attr("stroke-width", 3)
        .attr("opacity", 0.9);

      if (tooltipRef.current) {
        d3.select(tooltipRef.current)
          .style("opacity", 1)
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY - 20}px`)
          .html(nodeTooltip(node));
      }
    })
      .on("mouseout", function () {
        d3.select(this)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .attr("opacity", 1);

        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style("opacity", 0);
        }
      });

    links.on("mouseover", function (event, link) {
      d3.select(this)
        .attr("stroke", "#f4b400")
        .attr("stroke-opacity", 1)
        .attr("stroke-width", Math.sqrt(link.value || 1) * 2);

      if (tooltipRef.current) {
        d3.select(tooltipRef.current)
          .style("opacity", 1)
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY - 20}px`)
          .html(linkTooltip(link));
      }
    })
      .on("mouseout", function (link) {
        d3.select(this)
          .attr("stroke", "#666")
          .attr("stroke-opacity", 0.6)
          .attr("stroke-width", Math.sqrt(link.value || 1) * 1.2);

        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style("opacity", 0);
        }
      });

    // 5.7 Layout update
    simulation.on("tick", () => {
      links
        .attr("x1", d => (d.source as NetworkNode).x!)
        .attr("y1", d => (d.source as NetworkNode).y!)
        .attr("x2", d => (d.target as NetworkNode).x!)
        .attr("y2", d => (d.target as NetworkNode).y!);

      nodes
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      labels
        .attr("x", d => d.x!)
        .attr("y", d => d.y!);
    });

    // Cleanup function
    return () => {
      simulationRef.current?.stop();
    };
  }, [displayedNodes, displayedLinks, loading, nodeTooltip, linkTooltip, enableZoom]);

  // 6. Loading/error state display
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <h3>{title}</h3>
        <div>Loading network data... (Total papers: {data.nodes.length}, links: {data.links.length})</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "50px", color: "#d93025" }}>
        <h3>{title}</h3>
        <div>{error}</div>
      </div>
    );
  }

  // 7. No data fallback
  if (displayedNodes.length === 0 || displayedLinks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px", color: "#666" }}>
        <h3>{title}</h3>
        <div>No valid network data to display. Please check CSV file content.</div>
        <div>Original data volume: {data.nodes.length} nodes, {data.links.length} edges</div>
      </div>
    );
  }

  // 8. Main rendering
  return (
    <div style={{ margin: "30px 0" }}>
      <h2 style={{
        textAlign: "center",
        color: "#202124",
        fontSize: "1.5rem",
        marginBottom: "15px",
        fontWeight: 600
      }}>
        {title}
        <span style={{ fontSize: "0.8rem", color: "#666", marginLeft: "10px" }}>
          (Displayed: {displayedNodes.length} nodes / {displayedLinks.length} edges)
        </span>
      </h2>

      {enableZoom && (
        <div style={{ textAlign: "center", fontSize: "12px", color: "#666", marginBottom: "10px" }}>
          🖱️ Mouse wheel to zoom | Hold left click to pan | Drag nodes to reposition
        </div>
      )}

      <svg
        ref={svgRef}
        width={950}
        height={680}
        style={{
          border: "1px solid #e0e0e0",
          background: "#f8f9fa",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          cursor: enableZoom ? "grab" : "default",
          display: "block",
          margin: "0 auto"
        }}
      ></svg>

      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          background: "rgba(0,0,0,0.9)",
          color: "white",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "13px",
          pointerEvents: "none",
          opacity: 0,
          zIndex: 1000,
          maxWidth: "300px",
          boxShadow: "0 3px 6px rgba(0,0,0,0.2)"
        }}
      ></div>

      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "30px",
        marginTop: "15px",
        fontSize: "14px"
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width="20" height="20">
            <circle cx="10" cy="10" r="8" fill="#1a73e8" stroke="#fff" strokeWidth="1" />
          </svg>
          <span style={{ marginLeft: "8px" }}>Nodes (size = citation count)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            width: "30px",
            height: "2px",
            background: "#666",
            borderRadius: "1px"
          }}></div>
          <span style={{ marginLeft: "8px" }}>Edges (width = citation weight)</span>
        </div>
      </div>
    </div>
  );
};

export default BaseNetwork;