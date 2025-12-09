
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { csvParse } from 'd3-dsv';


interface CsvPaperData {
  paperid: string;
  year: string;
  patent_count: string;
}


interface PatentDistributionData {
  patentCount: number; // Patent citation count (0, 1, 2, ...)
  paperCount: number; // Number of papers with the corresponding citation count
}

const PatentHistogram: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<PatentDistributionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  useEffect(() => {
    const fetchAndParseCsv = async () => {
      setLoading(true);
      try {
       
        const csvResponse = await fetch('/yupaper_cs_15_25.csv');
        if (!csvResponse.ok) throw new Error(`CSV Loading failed: ${csvResponse.statusText}`);
        
        const csvText = await csvResponse.text();
    
        const parsedData = csvParse(csvText) as unknown as CsvPaperData[];
        
   
        const patentMap = new Map<number, number>();
        
        parsedData.forEach(row => {
          const patentCountStr = (row.patent_count || '0').trim();
          const patentCount = parseInt(patentCountStr, 10);
          
          if (isNaN(patentCount)) {
            console.warn('Skip invalid patent citation data:', row);
            return; // Skip invalid data
          }
          
          // Accumulate the number of papers with the corresponding citation count
          patentMap.set(patentCount, (patentMap.get(patentCount) || 0) + 1);
        });
        
        // Convert to sorted array (by citation count)
        const distributionData = Array.from(patentMap.entries())
          .map(([patentCount, paperCount]) => ({ patentCount, paperCount }))
          .sort((a, b) => a.patentCount - b.patentCount);
        
        setData(distributionData);
      } catch (err) {
        setError(`Data loading failed: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAndParseCsv();
  }, []);

 
  useEffect(() => {
    if (!svgRef.current || loading || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 900;
    const height = 400;
    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const barWidth = (width - margin.left - margin.right) / data.length * 0.7;

    // X-axis scale (number of patent citations)
    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.patentCount) || 0])
      .range([margin.left, width - margin.right]);

    // Y-axis scale (number of papers)
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.paperCount) || 0])
      .range([height - margin.bottom, margin.top]);

    // Plot the X-axis
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")))
      .selectAll("text")
      .style("font-size", "11px");

    // Plot the Y-axis
    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Number of Papers");

    // Plot the bars
    svg.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", d => x(d.patentCount) - barWidth / 2)
      .attr("y", d => y(d.paperCount))
      .attr("width", barWidth)
      .attr("height", d => height - margin.bottom - y(d.paperCount))
      .attr("fill", d => d.patentCount > 0 ? "#ff4d4f" : "#4285f4") // Red for citations, blue for no citations
      .attr("rx", 4)
      .attr("ry", 4);

    // Plot the bar labels (number of papers)
    svg.selectAll("text.bar-label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "bar-label")
      .attr("x", d => x(d.patentCount))
      .attr("y", d => y(d.paperCount) - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text(d => d.paperCount);

    // Hover tooltip
    const tooltip = svg.append("g")
      .attr("class", "tooltip")
      .style("display", "none");

    tooltip.append("rect")
      .attr("width", 120)
      .attr("height", 40)
      .attr("fill", "white")
      .attr("stroke", "#ccc")
      .attr("rx", 4)
      .attr("ry", 4);

    tooltip.append("text")
      .attr("x", 10)
      .attr("y", 20)
      .style("font-size", "12px");

    // Bar hover event - display patent count and paper count
    svg.selectAll("rect")
      .on("mouseover", function(event, d) {
        const data = d as PatentDistributionData;
        tooltip.style("display", "block")
          .attr("transform", `translate(${x(data.patentCount) - 60}, ${y(data.paperCount) - 50})`);
        tooltip.select("text")
          .text(`Patent Citations: ${data.patentCount} times (${data.paperCount} papers)`);
      })
      .on("mouseout", () => tooltip.style("display", "none"));

    // Title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", margin.top - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("Distribution of Patent Citations");

    // X-axis label
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Number of Patent Citations (Patent_Count)");
  }, [data, loading]);

  if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Loading CSV data...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>;

  return (
    <div>
      <svg ref={svgRef} width={900} height={400} style={{ border: '1px solid #e0e0e0', borderRadius: '8px' }} />
    </div>
  );
};

export default PatentHistogram;