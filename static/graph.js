(function (d3) {

d3.json("data.json", function(data) {
    var nodes = data.nodes, links = data.links;

    var w = 960,
        h = 500;

    var force = d3.layout.force()
        .nodes(nodes)
        .links(links)
        .size([w, h])
        .linkDistance(60)
        .charge(-300)
        .on("tick", tick)
        .start();

    var svg = d3.select("#chart").append("svg:svg")
        .attr("width", w)
        .attr("height", h);

    // Per-type markers, as they don't inherit styles.
    svg.append("svg:defs").selectAll("marker")
        .data(["suit", "licensing", "resolved"])
      .enter().append("svg:marker")
        .attr("id", String)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", -1.5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
      .append("svg:path")
        .attr("d", "M0,-5L10,0L0,5");

    var path = svg.append("svg:g").selectAll("path")
        .data(force.links())
      .enter().append("svg:path")
        .attr("class", function(d) { return "link suit"; })
        .attr("marker-end", function(d) { return "url(#suit)"; });

    var circle = svg.append("svg:g").selectAll("circle")
        .data(force.nodes())
      .enter().append("svg:circle")
        .attr("r", 6)
        .call(force.drag);

    var text = svg.append("svg:g").selectAll("g")
        .data(force.nodes())
      .enter().append("svg:g");

    // A copy of the text with a thick white stroke for legibility.
    text.append("svg:text")
        .attr("x", 8)
        .attr("y", ".31em")
        .attr("class", "shadow")
        .text(function(d) { return d.id; });

    text.append("svg:text")
        .attr("x", 8)
        .attr("y", ".31em")
        .text(function(d) { return d.id; });

    // Use elliptical arc path segments to doubly-encode directionality.
    function tick() {
      path.attr("d", function(d) {
        var dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            dr = Math.sqrt(dx * dx + dy * dy);
        return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
      });

      circle.attr("transform", function(d) {
        return "translate(" + d.x + "," + d.y + ")";
      });

      text.attr("transform", function(d) {
        return "translate(" + d.x + "," + d.y + ")";
      });
    }
});

}(this.d3));
