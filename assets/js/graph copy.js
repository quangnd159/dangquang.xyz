async function drawGraph(url, baseUrl, pathColors, depth, enableDrag, enableLegend, enableZoom) {

  // My first idea was to fetch data form the content/.obsidian/graph.json
  // to mimic the behaviour of the graph from obsidian using
  // center force, repel force, link force, link distance
  // but .obsidian is not in content by fetchData.
  // modifying fetchData in /layouts/partials/head.html is out of my domain skills at the minute.
  // Therfore, I will just add variables to modify the graph here.

  // A possibilty could be use frontmatter of the _index page like :
  // ---
  //  title: "Title page"
  //  scale : 1.5
  //  repelForce : 3
  //  centerForce : 1
  //  linkForce : 1
  //  linkDistance : 1
  //  fontSize : "7px"
  // ---
  //
  // and then we can access that with content[""].scale

  // GRAPH VARIABLES

  const scale = 1.5; // not used, could modify width ?
  const repelForce = 3;
  const centerForce = 1; // not used
  const linkForce = 1; // not used
  const linkDistance = 1 // not used

  const fontSize = "7px";
  const opacityNode = 0.7;

  // could add variables for text position dx dy on node
  // add varialbe for arrow, text-fade threshold, node size, link thickness,

  // -------------------

  const { index, links, content } = await fetchData
  const curPage = url.replace(baseUrl, "")

  const parseIdsFromLinks = (links) => [...(new Set(links.flatMap(link => ([link.source, link.target]))))]

  const neighbours = new Set()
  const wl = [curPage || "/", "__SENTINEL"]
  if (depth >= 0) {
    while (depth >= 0 && wl.length > 0) {
      // compute neighbours
      const cur = wl.shift()
      if (cur === "__SENTINEL") {
        depth--
        wl.push("__SENTINEL")
      } else {
        neighbours.add(cur)
        const outgoing = index.links[cur] || []
        const incoming = index.backlinks[cur] || []
        wl.push(...outgoing.map(l => l.target), ...incoming.map(l => l.source))
      }
    }
  } else {
    parseIdsFromLinks(links).forEach(id => neighbours.add(id))
  }

  const data = {
    nodes: [...neighbours].map(id => ({ id })),
    links: links.filter(l => neighbours.has(l.source) && neighbours.has(l.target)),
  }

  const color = (d) => {
    if (d.id === curPage || (d.id === "/" && curPage === "")) {
      return "var(--g-node-active)"
    }

    for (const pathColor of pathColors) {
      const path = Object.keys(pathColor)[0]
      const colour = pathColor[path]
      if (d.id.startsWith(path)) {
        return colour
      }
    }

    return "var(--g-node)"
  }

  const drag = simulation => {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(1).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    const noop = () => { }
    return d3.drag()
      .on("start", enableDrag ? dragstarted : noop)
      .on("drag", enableDrag ? dragged : noop)
      .on("end", enableDrag ? dragended : noop);
  }

  const height = 250
  const width = document.getElementById("graph-container").offsetWidth

  const simulation = d3.forceSimulation(data.nodes)
    .force("charge", d3.forceManyBody().strength(-100 * repelForce))
    .force("link", d3.forceLink(data.links).id(d => d.id))
    .force("center", d3.forceCenter());

  const svg = d3.select('#graph-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .style("font-size", fontSize);


  if (enableLegend) {
    const legend = [
      { "Current": "var(--g-node-active)" },
      { "Note": "var(--g-node)" },
      ...pathColors
    ]
    legend.forEach((legendEntry, i) => {
      const key = Object.keys(legendEntry)[0]
      const colour = legendEntry[key]
      svg.append("circle").attr("cx", -width / 2 + 20).attr("cy", height / 2 - 30 * (i + 1)).attr("r", 6).style("fill", colour)
      svg.append("text").attr("x", -width / 2 + 40).attr("y", height / 2 - 30 * (i + 1)).text(key).style("font-size", "15px").attr("alignment-baseline", "middle")
    })
  }

  // draw links between nodes
  const link = svg.append("g")
    .selectAll("line")
    .data(data.links)
    .join("line")
    .attr("class", "link")
    .attr("stroke", "var(--g-link)")
    .attr("stroke-width", 2)
    .attr("data-source", d => d.source.id)
    .attr("data-target", d => d.target.id)

  // svg groups
  const graphNode = svg.append("g")
    .selectAll("g")
    .data(data.nodes)
    .enter().append("g")

  // draw individual nodes
  const node = graphNode.append("circle")
    .attr("class", "node")
    .attr("id", (d) => d.id)
    .attr("r", (d) => {
      const numOut = index.links[d.id]?.length || 0
      const numIn = index.backlinks[d.id]?.length || 0
      return 3 + (numOut + numIn) / 4
    })
    .attr("fill", color)
    .style("cursor", "pointer")
    .on("click", (_, d) => {
      window.location.href = baseUrl + '/' + decodeURI(d.id).replace(/\s+/g, '-')
    })
    .on("mouseover", function(_, d) {
      d3.selectAll(".node")
        .transition()
        .duration(100)
        .attr("fill", "var(--g-node-inactive)")

      const neighbours = parseIdsFromLinks([...(index.links[d.id] || []), ...(index.backlinks[d.id] || [])])
      const neighbourNodes = d3.selectAll(".node").filter(d => neighbours.includes(d.id))
      const currentId = d.id
      const linkNodes = d3.selectAll(".link").filter(d => d.source.id === currentId || d.target.id === currentId)

      // highlight neighbour nodes
      neighbourNodes
        .transition()
        .duration(200)
        .attr("fill", color)

      // highlight links
      linkNodes
        .transition()
        .duration(200)
        .attr("stroke", "var(--g-link-active)")

      // show text for self
      d3.select(this.parentNode)
        .select("text")
        // .raise()
        // .transition()
        // .duration(200)
        .style("opacity", 1)
        .style("font-size", "12px")
        .style("font-family", "JetBrains Mono")
    })
    .on("mouseleave", function(_, d) {

      const currentId = d.id
      const linkNodes = d3.selectAll(".link").filter(d => d.source.id === currentId || d.target.id === currentId)

      linkNodes
        .transition()
        .duration(200)
        .attr("stroke", "var(--g-link)")

      d3.select(this.parentNode)
        .select("text")
        .raise()
        .transition()
        .duration(200)
        .style("opacity", opacityNode)

      d3.selectAll(".node")
        .transition()
        .duration(200)
        .attr("fill", color)

    })
    .call(drag(simulation));

  // draw labels
  const labels = graphNode.append("text")
    .attr("dx", 8)
    .attr("dy", ".35em")
    .text((d) => content[d.id]?.title || d.id.replace("-", " "))
    .style("opacity", 0)
    .style("pointer-events", "none")
    .raise()
    .call(drag(simulation));

  const labelsNew =  graphNode.append("text")
    .attr("dx", 8)
    .attr("dy", ".35em")
    .text((d) => content[d.id]?.title || d.id.replace("-", " "))
    .style("opacity", opacityNode)
    .style("font-size", "12px")
    .style("font-family", "JetBrains Mono")
    // .clone(true).lower()
    //   .attr("fill", "none")
    //   .attr("stroke", "white")
    //   .attr("stroke-width", 3);
    .raise()
    .call(drag(simulation));

  // for testiing

  // const test = svg
  //     .append("text")
  //     .style("font-size", "12px")
  //     // .text("Test");
  //     .text(content);

  // console.log(content); // /.obsidian dosen't apear in content.
  // console.log(content[]); // /.obsidian dosen't apear in content.
  // console.log(content[""]); // /.obsidian dosen't apear in content.
  // console.log(content[""].scale); // /.obsidian dosen't apear in content.

  // set panning

  if (enableZoom) {
    svg.call(d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.25, 4])
      .on("zoom", ({ transform }) => {
        link.attr("transform", transform);
        labels.attr("transform", transform);
        labelsNew.attr("transform", transform);
        node.attr("transform", transform).raise();
      }));
  }

  // progress the simulation
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y)
    labels
      .attr("x", d => d.x)
      .attr("y", d => d.y)
    labelsNew
      .attr("x", d => d.x)
      .attr("y", d => d.y)
    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .raise()

  });
}
