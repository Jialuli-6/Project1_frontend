
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { csvParse } from 'd3-dsv';

// Define the CSV data type (directly define the underlying object).
interface CsvPaperData {
  paperid: string;
  year: string;
  patent_count: string;
}

// Process and aggregate the parsed CSV data.
interface TimelineData {
  year: number;
  paperCount: number; // Number of papers published in the year.
  totalPatentCount: number; // Total patent citations for the year.
}

const DashboardTimeline: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<TimelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Parse the CSV file and aggregate the data.
  useEffect(() => {
    const fetchAndParseCsv = async () => {
      setLoading(true);
      try {
      
        const csvResponse = await fetch('/yupaper_cs_15_25.csv');
        if (!csvResponse.ok) throw new Error(`CSV Loading failed: ${csvResponse.statusText}`);
        
        const csvText = await csvResponse.text();
       
        const parsedData = csvParse(csvText) as unknown as CsvPaperData[];
        
        // 3. Data cleaning and aggregation (grouped by year)
        const yearMap = new Map<number, { paperCount: number; totalPatentCount: number }>();
        
        parsedData.forEach(row => {
          // Extract fields and remove spaces (to avoid leading and trailing spaces in CSV fields).
          const yearStr = (row.year || '').trim();
          const patentCountStr = (row.patent_count || '0').trim();
          
          // Convert data types and validate (ensure valid year and patent count).
          const year = parseInt(yearStr, 10);
          const patentCount = parseInt(patentCountStr, 10);
          
          // Skip invalid data rows (year out of range or non-numeric values).
          if (isNaN(year) || year < 2015 || year > 2024 || isNaN(patentCount)) {
            console.warn('Skip invalid data rows:', row);
            return;
          }
          
          // Aggregate data by year (paper count and total patent count).
          if (!yearMap.has(year)) {
            yearMap.set(year, { paperCount: 0, totalPatentCount: 0 });
          }
          
          const yearData = yearMap.get(year)!;
          yearData.paperCount += 1; // Increment paper count for the year.
          yearData.totalPatentCount += patentCount; // Accumulate patent citations.
        });
        
        // 4. Convert to sorted array (by year)
        const timelineData = Array.from(yearMap.entries())
          .map(([year, values]) => ({ year, ...values }))
          .sort((a, b) => a.year - b.year);
        
        setData(timelineData);
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
    const margin = { top: 30, right: 80, bottom: 40, left: 50 }; 

    // Define the X-axis scale (year).
    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year) as [number, number])
      .range([margin.left, width - margin.right]);

    // Define the left Y-axis scale (paper count).
    const y1 = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.paperCount) || 0])
      .range([height - margin.bottom, margin.top]);

    // Define the right Y-axis scale (patent citation count).
    const y2 = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.totalPatentCount) || 0])
      .range([height - margin.bottom, margin.top]);

    // Define the paper count line generator.
    const paperLine = d3.line<TimelineData>()
      .x(d => x(d.year))
      .y(d => y1(d.paperCount))
      .curve(d3.curveMonotoneX);

    // Patent reference line generator
    const patentLine = d3.line<TimelineData>()
      .x(d => x(d.year))
      .y(d => y2(d.totalPatentCount))
      .curve(d3.curveMonotoneX);

    // Draw the X-axis
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("font-size", "11px");

    // Draw the left Y-axis (paper count)
    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y1))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#1a73e8")
      .text("Number of papers published");

    // Draw the right Y-axis (patent citation count)
    svg.append("g")
      .attr("transform", `translate(${width - margin.right}, 0)`)
      .call(d3.axisRight(y2))
      .append("text")
      .attr("transform", "rotate(90)")
      .attr("x", height / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#ff4d4f")
      .text("Total number of patent citations");

    // Draw the paper count line
    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#1a73e8")
      .attr("stroke-width", 2.5)
      .attr("d", paperLine);

    // Draw the patent reference line
    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#ff4d4f")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "5,5") // Dashed line for distinction
      .attr("d", patentLine);

    // Draw the paper count data points + labels
    svg.selectAll("circle.paper")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "paper")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y1(d.paperCount))
      .attr("r", 4)
      .attr("fill", "#1a73e8");

    // Draw the patent reference data points + labels
    svg.selectAll("circle.patent")
      .data(data.filter(d => d.totalPatentCount > 0)) // Only show points with citations
      .enter()
      .append("circle")
      .attr("class", "patent")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y2(d.totalPatentCount))
      .attr("r", 4)
      .attr("fill", "#ff4d4f");

    // Draw the tooltip group (hidden initially)
    const tooltip = svg.append("g")
      .attr("class", "tooltip")
      .style("display", "none");

    tooltip.append("rect")
      .attr("width", 150)
      .attr("height", 60)
      .attr("fill", "white")
      .attr("stroke", "#ccc")
      .attr("rx", 4)
      .attr("ry", 4);

    
    tooltip.append("text")
      .attr("class", "text-year")
      .attr("x", 10)
      .attr("y", 20)
      .style("font-size", "12px");

    
    tooltip.append("text")
      .attr("class", "text-count")
      .attr("x", 10)
      .attr("y", 40)
      .style("font-size", "12px");

   
    svg.selectAll("circle.paper")
      .on("mouseover", function(event, d) {
        const data = d as TimelineData;
        tooltip.style("display", "block")
          .attr("transform", `translate(${x(data.year) + 10}, ${y1(data.paperCount) - 30})`);
        
        
        tooltip.select(".text-year")
          .text(`year: ${data.year}`);
       
        tooltip.select(".text-count")
          .text(`paper count: ${data.paperCount}`);
      })
      .on("mouseout", () => tooltip.style("display", "none"));

    // Draw the patent reference point hover event - use class selector for text elements
    svg.selectAll("circle.patent")
      .on("mouseover", function(event, d) {
        const data = d as TimelineData;
        tooltip.style("display", "block")
          .attr("transform", `translate(${x(data.year) + 10}, ${y2(data.totalPatentCount) - 30})`);
        
        tooltip.select(".text-year")
          .text(`year: ${data.year}`);
        tooltip.select(".text-count")
          .text(`patent count: ${data.totalPatentCount}`);
      })
      .on("mouseout", () => tooltip.style("display", "none"));

    // 标题
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", margin.top - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("Trends in the number of papers and patent citations, 2015-2024");
  }, [data, loading]);

  if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Loading CSV data...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>;

  return (
    <div style={{ marginBottom: 40 }}>
      <svg ref={svgRef} width={900} height={400} style={{ border: '1px solid #e0e0e0', borderRadius: '8px' }} />
    </div>
  );
};

export default DashboardTimeline;