import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { csvParse } from 'd3-dsv';
import type { Simulation } from 'd3-force';

// 1. Extend type definitions (add author-author collaboration links)
interface AuthorNode extends d3.SimulationNodeDatum {
  id: string; // Format: author_${authorid}
  type: 'author';
  authorid: string;
  institutionid: string;
  paper_count: number; // Number of papers participated in
  name: string; // Simplified display name
}

interface PaperNode extends d3.SimulationNodeDatum {
  id: string; // Format: paper_${paperid}
  type: 'paper';
  paperid: string;
  author_count: number; // Total number of authors for the paper
  name: string; // Simplified display name
}

type CollabNode = AuthorNode | PaperNode;

// Author-paper association links (original type)
interface AuthorPaperLink extends d3.SimulationLinkDatum<CollabNode> {
  source: string | CollabNode;
  target: string | CollabNode;
  type: 'author-paper';
  paperid: string;
  author_position: string;
  value: number; // Weight fixed at 1
}

// New: Author-author collaboration links (record collaboration count)
interface AuthorAuthorLink extends d3.SimulationLinkDatum<AuthorNode> {
  source: string | AuthorNode;
  target: string | AuthorNode;
  type: 'author-author';
  collaboration_count: number; // Core: number of collaborations
  paper_ids: string[]; // List of co-authored paper IDs
}

// Combined link types
type CollabLink = AuthorPaperLink | AuthorAuthorLink;

interface AffilCsvData {
  paperid: string;
  author_position: string;
  authorid: string;
  institutionid: string;
  raw_affiliation_string: string;
}

interface CollabNetworkProps {
  title: string;
  nodeTooltip: (node: CollabNode) => string;
  linkTooltip: (link: CollabLink) => string;
  maxNodes?: number;
  enableZoom?: boolean;
}

// Default configuration
const DEFAULT_CONFIG = {
  maxNodes: 800,
  enableZoom: true
};

// 2. Color schemes
const COLOR_SCHEMES = {
  main: [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'
  ],
  soft: [
    '#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3',
    '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd',
    '#ccebc5', '#ffed6f'
  ],
  dark: [
    '#001f3f', '#0074d9', '#2ecc40', '#ffdc00', '#ff851b',
    '#ff4136', '#85144b', '#b10dc9', '#111111', '#aaaaaa'
  ]
};

const AuthorCollabNetwork: React.FC<CollabNetworkProps> = ({
  title,
  nodeTooltip,
  linkTooltip,
  maxNodes = DEFAULT_CONFIG.maxNodes,
  enableZoom = DEFAULT_CONFIG.enableZoom
}) => {
  // DOM references
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<Simulation<CollabNode, CollabLink> | null>(null);

  // State management
  const [data, setData] = useState<{ nodes: CollabNode[]; links: CollabLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayedNodes, setDisplayedNodes] = useState<CollabNode[]>([]);
  const [displayedLinks, setDisplayedLinks] = useState<CollabLink[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);

  // 3. Load and preprocess CSV data (add author collaboration count statistics)
  useEffect(() => {
    const fetchAndParseData = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch('/affils_yeshiva_cs_20_25.csv');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        const rawData = csvParse(csvText) as unknown as AffilCsvData[];
        console.log('Raw data count:', rawData.length);

        // Filter valid data
        const validData = rawData.filter(row => {
          const paperId = row.paperid?.trim();
          const authorId = row.authorid?.trim();
          const institutionId = row.institutionid?.trim();
          const position = row.author_position?.trim();
          return !!paperId && !!authorId && !!institutionId && !!position;
        });
        console.log('Filtered data count:', validData.length);

        // Collect institution IDs
        const uniqueInstitutionIds = Array.from(new Set(
          validData.map(row => row.institutionid.trim())
        ));
        setInstitutionIds(uniqueInstitutionIds);

        // Statistical auxiliary data
        const authorPaperMap = new Map<string, string[]>(); // Author-paper mapping
        const paperAuthorMap = new Map<string, string[]>(); // Paper-author mapping

        validData.forEach(row => {
          const paperId = row.paperid.trim();
          const authorId = row.authorid.trim();

          // Update author-paper mapping
          if (!authorPaperMap.has(authorId)) authorPaperMap.set(authorId, []);
          if (!authorPaperMap.get(authorId)?.includes(paperId)) {
            authorPaperMap.get(authorId)?.push(paperId);
          }

          // Update paper-author mapping
          if (!paperAuthorMap.has(paperId)) paperAuthorMap.set(paperId, []);
          if (!paperAuthorMap.get(paperId)?.includes(authorId)) {
            paperAuthorMap.get(paperId)?.push(authorId);
          }
        });

        // 4. Generate node data
        const nodes: CollabNode[] = [];

        // 4.1 Author nodes
        authorPaperMap.forEach((paperIds, authorId) => {
          const firstRecord = validData.find(row => row.authorid.trim() === authorId);
          const institutionId = firstRecord?.institutionid.trim() || 'default';
          nodes.push({
            id: `author_${authorId}`,
            type: 'author',
            authorid: authorId,
            institutionid: institutionId,
            paper_count: paperIds.length,
            name: `Author_${authorId.slice(-6)}`
          });
        });

        // 4.2 Paper nodes
        paperAuthorMap.forEach((authorIds, paperId) => {
          nodes.push({
            id: `paper_${paperId}`,
            type: 'paper',
            paperid: paperId,
            author_count: authorIds.length,
            name: `Paper_${paperId.slice(-6)}`
          });
        });

        // 5. Generate link data (including author-author collaboration links)
        // 5.1 Original author-paper links
        const authorPaperLinks: AuthorPaperLink[] = validData.map(row => ({
          source: `author_${row.authorid.trim()}`,
          target: `paper_${row.paperid.trim()}`,
          type: 'author-paper',
          paperid: row.paperid.trim(),
          author_position: row.author_position.trim(),
          value: 1
        }));

        // 5.2 New author-author collaboration links (count collaboration times)
        const authorCollabMap = new Map<string, { count: number; papers: Set<string> }>();
        
        // Traverse all papers to count author pair collaborations
        paperAuthorMap.forEach((authorIds, paperId) => {
          for (let i = 0; i < authorIds.length; i++) {
            for (let j = i + 1; j < authorIds.length; j++) {
              const a1 = authorIds[i];
              const a2 = authorIds[j];
              const key = [a1, a2].sort().join('-'); // Generate unique key to avoid duplicates
              
              if (!authorCollabMap.has(key)) {
                authorCollabMap.set(key, { count: 0, papers: new Set() });
              }
              const collab = authorCollabMap.get(key)!;
              collab.count += 1;
              collab.papers.add(paperId);
            }
          }
        });

        // Convert to author-author link data
        const authorAuthorLinks: AuthorAuthorLink[] = Array.from(authorCollabMap.entries()).map(
          ([key, { count, papers }]) => {
            const [a1, a2] = key.split('-');
            return {
              source: `author_${a1}`,
              target: `author_${a2}`,
              type: 'author-author',
              collaboration_count: count,
              paper_ids: Array.from(papers)
            };
          }
        );

        // Combine all links
        const allLinks: CollabLink[] = [...authorPaperLinks, ...authorAuthorLinks];

        // 6. Limit node quantity
        const authorNodes = nodes.filter(node => node.type === 'author') as AuthorNode[];
        const paperNodes = nodes.filter(node => node.type === 'paper') as PaperNode[];

        const sortedAuthors = [...authorNodes].sort((a, b) => b.paper_count - a.paper_count);
        const sortedPapers = [...paperNodes].sort((a, b) => b.author_count - a.author_count);

        const authorQuota = Math.floor(maxNodes * 0.7);
        const paperQuota = maxNodes - authorQuota;

        const limitedAuthors = sortedAuthors.slice(0, authorQuota);
        const limitedPapers = sortedPapers.slice(0, paperQuota);
        const finalNodes: CollabNode[] = [...limitedAuthors, ...limitedPapers];
        const limitedNodeIds = new Set(finalNodes.map(node => node.id));

        // Filter links (only keep links where both endpoints are in display list)
        const filteredLinks = allLinks.filter(link => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
          return limitedNodeIds.has(sourceId.toString()) && limitedNodeIds.has(targetId.toString());
        });

        setData({ nodes, links: allLinks });
        setDisplayedNodes(finalNodes);
        setDisplayedLinks(filteredLinks);
      } catch (err) {
        setError(`Data loading failed: ${(err as Error).message}`);
        console.error('Data loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndParseData();
  }, [maxNodes]);

  // 7. Draw collaboration network chart (support collaboration count visualization)
  useEffect(() => {
    if (!svgRef.current || displayedNodes.length === 0 || displayedLinks.length === 0 || loading || institutionIds.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 950;
    const height = 680;

    // 7.1 Coloring logic
    let colorScheme = COLOR_SCHEMES.main;
    if (institutionIds.length > 15) colorScheme = COLOR_SCHEMES.soft;
    if (institutionIds.length > 25) colorScheme = [...COLOR_SCHEMES.main, ...COLOR_SCHEMES.soft];

    const institutionColorMap = new Map(
      institutionIds.map((id, index) => [id, colorScheme[index % colorScheme.length]])
    );

    const getNodeColor = (node: CollabNode) => {
      if (node.type === 'author') {
        return institutionColorMap.get((node as AuthorNode).institutionid) || '#1a73e8';
      } else {
        const authorCount = (node as PaperNode).author_count;
        const saturation = Math.min(70, 30 + authorCount * 5);
        return `hsl(30, ${saturation}%, 60%)`;
      }
    };

    // 7.2 Zoom functionality
    if (enableZoom) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
          svg.select(".network-container").attr("transform", event.transform);
        });
      svg.call(zoom);
    }

    // Create container group
    const container = svg.append("g")
      .attr("class", "network-container")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // 7.3 Force-directed layout (adjust parameters based on link type)
    const linkForce = d3.forceLink<CollabNode, CollabLink>(displayedLinks)
      .id((node) => node.id)
      .distance((link) => {
        // More collaborations mean closer author nodes
        if (link.type === 'author-author') {
          return Math.max(50, 150 - (link as AuthorAuthorLink).collaboration_count * 10);
        }
        return 80; // Fixed distance for author-paper links
      })
      .strength((link) => {
        // More collaborations mean stronger attraction
        if (link.type === 'author-author') {
          return Math.min(0.8, 0.2 + (link as AuthorAuthorLink).collaboration_count * 0.1);
        }
        return 0.3;
      });

    const collideForce = d3.forceCollide()
      .radius((node) => {
        if (node.type === 'author') {
          const safeCount = Math.max((node as AuthorNode).paper_count, 1);
          return 12 + Math.log(safeCount) * 3;
        } else {
          const safeCount = Math.max((node as PaperNode).author_count, 1);
          return 10 + Math.log(safeCount) * 2;
        }
      })
      .iterations(3);

    const chargeForce = d3.forceManyBody()
      .strength((node) => node.type === 'author' ? -200 : -150)
      .distanceMax(300);

    const simulation = d3.forceSimulation<CollabNode, CollabLink>(displayedNodes)
      .force("link", linkForce)
      .force("charge", chargeForce)
      .force("center", d3.forceCenter(0, 0))
      .force("collide", collideForce)
      .alphaDecay(0.01)
      .velocityDecay(0.7);

    simulationRef.current = simulation;

    // 7.4 Draw links (differentiate display by type)
    const links = container.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(displayedLinks)
      .enter()
      .append("line")
      .attr("stroke", (link) => {
        if (link.type === 'author-author') {
          // Author collaboration links: dark color series, opacity increases with collaboration count
          const opacity = Math.min(0.9, 0.3 + (link as AuthorAuthorLink).collaboration_count * 0.1);
          return `rgba(50,50,50,${opacity})`;
        } else {
          // Author-paper links: follow original logic
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const authorNode = displayedNodes.find(n => n.id === sourceId && n.type === 'author');
          return authorNode ? `${getNodeColor(authorNode)}80` : "#6668";
        }
      })
      .attr("stroke-width", (link) => {
        if (link.type === 'author-author') {
          // More collaborations mean thicker links
          return Math.sqrt((link as AuthorAuthorLink).collaboration_count) * 2;
        } else {
          return Math.sqrt(link.value || 1) * 1.5;
        }
      })
      .attr("stroke-linecap", "round");

    // 7.5 Draw nodes
    const nodes = container.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(displayedNodes)
      .enter()
      .append("circle")
      .attr("r", (node) => {
        if (node.type === 'author') {
          const safeCount = Math.max((node as AuthorNode).paper_count, 1);
          return 12 + Math.log(safeCount) * 3;
        } else {
          const safeCount = Math.max((node as PaperNode).author_count, 1);
          return 10 + Math.log(safeCount) * 2;
        }
      })
      .attr("fill", getNodeColor)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("cursor", "move")
      .call(
        d3.drag<SVGCircleElement, CollabNode>()
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

    // 7.6 Draw node labels
    const labels = container.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(displayedNodes)
      .enter()
      .append("text")
      .text((node) => node.name)
      .attr("font-size", 10)
      .attr("dx", (node) => node.type === 'author' ? 15 : 12)
      .attr("dy", 4)
      .attr("fill", "#333")
      .attr("pointer-events", "none")
      .attr("text-anchor", "start");

    // 7.7 Tooltip interaction
    nodes.on("mouseover", function (event, node) {
      d3.select(this)
        .attr("stroke", node.type === 'author' ? "#000" : "#e69138")
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
        .attr("stroke-opacity", 1)
        .attr("stroke-width", link.type === 'author-author' 
          ? Math.sqrt((link as AuthorAuthorLink).collaboration_count) * 3 
          : Math.sqrt(link.value || 1) * 2.5
        );

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
          .attr("stroke-opacity", 0.6)
          .attr("stroke-width", link.type === 'author-author'
            ? Math.sqrt((link as AuthorAuthorLink).collaboration_count) * 2
            : Math.sqrt(link.value || 1) * 1.5
          );

        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style("opacity", 0);
        }
      });

    // 7.8 Layout update
    simulation.on("tick", () => {
      links
        .attr("x1", d => (d.source as CollabNode).x!)
        .attr("y1", d => (d.source as CollabNode).y!)
        .attr("x2", d => (d.target as CollabNode).x!)
        .attr("y2", d => (d.target as CollabNode).y!);

      nodes
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      labels
        .attr("x", d => d.x!)
        .attr("y", d => d.y!);
    });

    return () => {
      simulationRef.current?.stop();
    };
  }, [displayedNodes, displayedLinks, loading, nodeTooltip, linkTooltip, enableZoom, institutionIds]);

  // 8. Generate legend
  const renderInstitutionLegend = () => {
    if (institutionIds.length === 0 || loading) return null;

    const topInstitutions = institutionIds.slice(0, 10);
    const hasMore = institutionIds.length > 10;

    return (
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        marginTop: "15px",
        padding: "10px",
        backgroundColor: "#f5f5f5",
        borderRadius: "6px",
        maxWidth: "800px",
        margin: "0 auto"
      }}>
        <div style={{ fontWeight: 600, marginRight: "10px" }}>Institution Color Legend:</div>
        {topInstitutions.map((instId) => (
          <div key={instId} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              marginRight: "5px",
              backgroundColor: institutionIds.findIndex(id => id === instId) < COLOR_SCHEMES.main.length
                ? COLOR_SCHEMES.main[institutionIds.findIndex(id => id === instId) % COLOR_SCHEMES.main.length]
                : COLOR_SCHEMES.soft[institutionIds.findIndex(id => id === instId) % COLOR_SCHEMES.soft.length]
            }}></div>
            <span style={{ fontSize: "12px" }}>{instId}</span>
          </div>
        ))}
        {hasMore && <span style={{ fontSize: "12px", color: "#666" }}>...and {institutionIds.length - 10} more</span>}
      </div>
    );
  };

  // 9. Status display
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <h3>{title}</h3>
        <div>Loading collaboration network... (Total nodes: {data.nodes.length}, links: {data.links.length})</div>
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

  if (displayedNodes.length === 0 || displayedLinks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px", color: "#666" }}>
        <h3>{title}</h3>
        <div>No valid collaboration data to display.</div>
      </div>
    );
  }

  // 10. Main rendering
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

      {/* Legend */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        marginTop: "15px"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          flexWrap: "wrap",
          fontSize: "14px"
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="20" height="20">
              <circle cx="10" cy="10" r="8" fill="#1f77b4" stroke="#fff" strokeWidth="1" />
            </svg>
            <span style={{ marginLeft: "8px" }}>Author nodes (color = institution)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="20" height="20">
              <circle cx="10" cy="10" r="7" fill="#ff9933" stroke="#fff" strokeWidth="1" />
            </svg>
            <span style={{ marginLeft: "8px" }}>Paper nodes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: "30px", height: "2px", background: "#6668", borderRadius: "1px" }}></div>
            <span style={{ marginLeft: "8px" }}>Author-paper connections</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: "30px", height: "2px", background: "#333", borderRadius: "1px" }}></div>
            <span style={{ marginLeft: "8px" }}>Author collaborations (thickness = count)</span>
          </div>
        </div>
        {renderInstitutionLegend()}
      </div>
    </div>
  );
};

export default AuthorCollabNetwork;