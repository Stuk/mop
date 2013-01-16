(function (d3) {

var width = 960,
    height = 500;

var force = d3.layout.force()
    .charge(-250)
    .size([width, height]);

var svg = d3.select("#chart").append("svg")
    .attr("width", width)
    .attr("height", height);

var globalLinks, link;

d3.json("data.json", function(data) {
    var nodes = data.nodes, links = data.links;

    force
        .nodes(nodes)
        .links(links)
        .start();

    link = svg.selectAll("line.link")
        .data(links)
      .enter().append("line")
        .attr("class", "link");

    var g = svg.selectAll("g.node")
        .data(nodes)
      .enter().append("svg:g")
        .classed("node", true)
        .call(force.drag);

    g.append("svg:circle")
        .attr("r", 5);
        // .style("fill", function(d, i) { return color(i); });

    g.append("svg:text")
        .attr("x", 10)
        .attr("dy", ".31em")
        .text(function(d) { return d.id; });

    force.on("tick", function() {
      link.attr("x1", function(d) { return d.source.x; })
          .attr("y1", function(d) { return d.source.y; })
          .attr("x2", function(d) { return d.target.x; })
          .attr("y2", function(d) { return d.target.y; });

      g.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

    });
  });
}(this.d3));
