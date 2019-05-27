import React, { Component } from "react";
import saveSvgAsPng from "./Download";
const d3 = require("d3");

var globalCellRef = undefined;

// Radius of nodes
const radius = 5;
// Padding between nodes and cellular components that should not crossover
const unlocalizedMargin = 15;
const width = window.innerHeight;
const height = window.innerHeight;
const viewportCenter = { x: width / 2, y: height / 2 - 30 };
const organelleRadius = 60;
const organelleMembraneWidth = 15;
const nodeRadius = 5;
const selectedNodeRadius = 15;
const padding = 5;
const plasmaMembraneWidth = 30;
const extracellularWidth = 30;
let gnodes;
// Cellular components that need to be drawn regardless of whether or not they contain nodes within them
const defaultOrganelleNames = ["extracellular", "cytoplasm", "plasma_membrane"];

// Calculate and return the distance between two points
const calculateDistance = (x1, y1, x2, y2) =>
  Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
// Constraint the cell inside a cell component, optionally constrained not to enter some components
const constraintInsideCell = (
  x,
  y,
  component,
  components = [],
  nodeRadius = 0
) => {
  const nodePadding = nodeRadius ? nodeRadius + 10 : padding;
  const { cx, cy, rmax, rmin } = component;
  let R = calculateDistance(x, y, cx, cy);
  if (R > rmax - nodePadding) {
    return {
      x: ((rmax - nodePadding) / R) * (x - cx) + cx,
      y: ((rmax - nodePadding) / R) * (y - cy) + cy
    };
  } else if (R < rmin + nodePadding) {
    return {
      x: ((rmin + nodePadding) / R) * (x - cx) + cx,
      y: ((rmin + nodePadding) / R) * (y - cy) + cy
    };
  } else {
    for (let i = 0; i < components.length; i++) {
      const { cx, cy, rmax } = components[i];
      R = calculateDistance(x, y, cx, cy);
      if (R < rmax + nodePadding) {
        const position = {
          x: ((rmax + nodePadding) / R) * (x - cx) + cx,
          y: ((rmax + nodePadding) / R) * (y - cy) + cy
        };
        return position;
      }
    }
  }
  return { x: x, y: y };
};

// Constraint the cell outside the cell and not let it enter the cell
const constraintOutsideCell = (x, y, cell) => {
  var border = cell["extracellular"];
  let R = calculateDistance(x, y, border.cx, border.cy);
  if (R < border.rmax + unlocalizedMargin) {
    return {
      x: ((border.rmax + unlocalizedMargin) / R) * (x - border.cx) + border.cx,
      y: ((border.rmax + unlocalizedMargin) / R) * (y - border.cy) + border.cy
    };
  }
  // Do not let the node out of the viewport
  return {
    x:
      x < unlocalizedMargin
        ? unlocalizedMargin
        : x > width - unlocalizedMargin
        ? width - unlocalizedMargin
        : x,
    y:
      y < unlocalizedMargin
        ? unlocalizedMargin
        : y > height - unlocalizedMargin
        ? height - unlocalizedMargin
        : y
  };
};

export default class CellVisualizer extends Component {
  constructor(props) {
    super(props);
    this.simulation = undefined;
    this.organnelSimulation = undefined;
    this.svg = undefined;
    this.node = undefined;
    this.link = undefined;
    this.cell = {};
  }

  componentDidMount() {
    this.initCellStructure();
  }

  componentDidUpdate(prevProp) {
    if (prevProp.data == this.props.data) {
      if (this.node) this.node.attr("fill", d => this.props.colorSelector(d));
    } else if (this.props.data) {
      this.initCellStructure();
    }
    // Check if a node is selected and single it out in the visualization
    this.handleNodeSelection(prevProp.selectedNode);
  }

  handleNodeSelection(previouslySelectedNode) {
    if (!this.node || !this.props.selectedNode) return;
    if (this.props.selectedNode === previouslySelectedNode) return;
    d3.select(`circle#${previouslySelectedNode.id}`).attr("r", nodeRadius);
    d3.select(`circle#${this.props.selectedNode.id}`)
      .transition()
      .duration(200)
      .attr("r", selectedNodeRadius);
  }

  parseTranslateValues(translate) {
    return translate
      .replace("translate(", "")
      .replace(")", "")
      .split(",")
      .map(v => +v);
  }

  reset() {
    this.simulation && this.simulation.stop();
    this.organnelSimulation && this.organnelSimulation.stop();
    this.cell = {};
    d3.selectAll("#svg").remove();
  }

  initCellStructure() {
    this.props.updateLoadingStatus(true);
    this.simulation && this.simulation.stop();
    this.organnelSimulation && this.organnelSimulation.stop();
    this.cell = {};
    d3.selectAll("#svg").remove();
    this.svg = d3
      .select("#svg_wrapper")
      .append("svg")
      .attr("id", "svg")
      .attr("width", width)
      .attr("height", height);

    this.cell["extracellular"] = {
      cx: viewportCenter.x,
      cy: viewportCenter.y,
      rmax: height / 2 - 45,
      rmin: height / 2 - 45 - extracellularWidth
    };

    this.cell["plasma_membrane"] = {
      cx: viewportCenter.x,
      cy: viewportCenter.y,
      rmax: this.cell["extracellular"].rmin,
      rmin: this.cell["extracellular"].rmin - plasmaMembraneWidth
    };

    this.cell["cytoplasm"] = {
      cx: viewportCenter.x,
      cy: viewportCenter.y,
      rmax: this.cell["plasma_membrane"].rmin,
      rmin: 0
    };

    const componentNamesSet = new Set(
      defaultOrganelleNames.concat(
        this.props.groupMapping.map(m => (m.membrane ? m.membrane : null))
      )
    );
    const uniqueNodes = this.props.data.nodes.filter(
      function(obj) {
        if (obj.location && !componentNamesSet.has(obj.location)) {
          componentNamesSet.add(obj.location);
          this.cell[obj.location] = {
            cx: viewportCenter.x,
            cy: viewportCenter.y,
            rmax: organelleRadius,
            rmin: 0
          };
          return obj;
        }
      }.bind(this)
    );

    var extracellular = this.svg
      .append("g")
      .attr("class", "group_component")
      .attr("id", "extracellular_group")
      .append("circle")
      .attr("id", "extracellular")
      .attr("r", this.cell["extracellular"].rmax)
      .attr("cx", this.cell["extracellular"].cx)
      .attr("cy", this.cell["extracellular"].cy);

    var plasmaMembrane = this.svg
      .append("g")
      .attr("class", "group_component")
      .attr("id", "plasma_membrane_group")
      .append("circle")
      .attr("id", "plasma_membrane")
      .attr("r", this.cell["plasma_membrane"].rmax)
      .attr("cx", this.cell["plasma_membrane"].cx)
      .attr("cy", this.cell["plasma_membrane"].cy);

    var cytoplasm = this.svg
      .append("g")
      .attr("class", "group_component")
      .attr("id", "cytoplasm_group")
      .append("circle")
      .attr("id", "cytoplasm")
      .attr("r", this.cell["cytoplasm"].rmax)
      .attr("cx", this.cell["cytoplasm"].cx)
      .attr("cy", this.cell["cytoplasm"].cy);

    gnodes = this.svg
      .selectAll("g.gnode")
      .data(uniqueNodes)
      .enter()
      .append("g")
      .attr("class", "group_component")
      .attr(
        "id",
        function(d) {
          return d.location + "_group";
        }.bind(this)
      );

    gnodes.append("svg:title").text(d => d.location);

    gnodes.attr("membrane", d =>
      this.props.groupMapping.find(m => m.component === d.location)
        ? this.props.groupMapping.find(m => m.component === d.location).membrane
        : null
    );

    const visualiser = this;
    const groupMapping = this.props.groupMapping;

    gnodes.each(function(d, i) {
      const m = groupMapping.find(m => m.component === d.location);
      if (m && m.membrane) {
        d3.select(this)
          .append("circle")
          .style("fill", "#f6ebf9")
          .attr("id", m.membrane)
          .attr("class", "membrane")
          .attr("r", organelleRadius + organelleMembraneWidth);

        visualiser.cell[m.membrane] = {
          cx: visualiser.cell[d.location].cx,
          cy: visualiser.cell[d.location].cy,
          rmax: organelleRadius + organelleMembraneWidth,
          rmin: visualiser.cell[d.location].rmax
        };
      }
    });

    const node = gnodes
      .append("circle")
      .attr("stroke", "#d29be3")
      .attr("fill", "#f6ebf9")
      .attr("stroke-width", 1)
      .attr(
        "id",
        function(d) {
          return d.location;
        }.bind(this)
      )
      .attr("r", organelleRadius)
      .attr("class", "node");

    gnodes
      .append("text")
      .style("fill", "#74278c")
      .style("font-size", "0.7rem")
      .attr("text-anchor", "middle")
      .attr("y", 30)
      .text(d => d.location);

    this.organnelSimulation = d3
      .forceSimulation(uniqueNodes)
      .force("repel", d3.forceManyBody())
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius(function(d) {
          return organelleRadius + 15;
        })
      );

    this.organnelSimulation
      .on(
        "tick",
        function() {
          const cell = this.cell;
          const cytoplasm = cell["cytoplasm"];
          const groupMapping = this.props.groupMapping;
          gnodes.each(function(d) {
            const result = constraintInsideCell(
              d.x,
              d.y,
              cytoplasm,
              [],
              organelleRadius + 15
            );

            d3.select(this).attr("transform", function(d, i) {
              return "translate(" + result.x + "," + result.y + ")";
            });
            cell[d.location].cx = result.x;
            cell[d.location].cy = result.y;
            if (groupMapping.find(m => m.component === d.location)) {
              let membraneName = groupMapping.find(
                m => m.component === d.location
              ).membrane;
              cell[membraneName].cx = result.x;
              cell[membraneName].cy = result.y;
            }
          });
        }.bind(this)
      )
      .on(
        "end",
        function() {
          console.log("Organelles inistialised");
          this.props.updateLoadingStatus(false);
          this.props.data && this.initGraph();
        }.bind(this)
      );
    globalCellRef = this.cell;
  }

  initGraph() {
    this.simulation = d3
      .forceSimulation(this.props.data.nodes)
      .force("repel", d3.forceManyBody().strength(1))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "link",
        d3
          .forceLink(this.props.data.links)
          .id(d => d.id)
          .strength(0.0000000001)
      )
      .force(
        "collision",
        d3.forceCollide().radius(function(d) {
          return nodeRadius + 1.5;
        })
      )
      .force(
        "x",
        d3
          .forceX()
          .strength(0.1)
          .x(function(d) {
            if (d.location && d.location != "extracellular") {
              return globalCellRef[d.location].cx;
            }
            return width / 2;
          })
      )
      .force(
        "y",
        d3
          .forceY()
          .strength(0.1)
          .y(function(d) {
            if (d.location && d.location != "extracellular") {
              return globalCellRef[d.location].cy;
            }
            return height / 2;
          })
      );

    this.link = this.svg
      .append("g")
      .selectAll(".edge")
      .data(this.props.data.links)
      .enter()
      .append("line")
      .attr("class", "edge")

      .attr("id", function(d) {
        return d.id;
      });

    var gnodes = this.svg
      .selectAll("g.gnode")
      .data(this.props.data.nodes)
      .enter()
      .append("g")
      .attr("id", function(d) {
        return d.id + "_g";
      });

    this.node = gnodes
      .append("circle")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("id", d => d.id)
      .attr("r", nodeRadius - 0.75)
      .attr("class", "node")
      .attr("fill", d => this.props.colorSelector(d))
      .on(
        "click",
        function(d, i) {
          this.props.onNodeSelected(d);
        }.bind(this)
      )
      .call(this.drag(this.simulation));

    d3.select("#download").on("click", function() {
      // Get the d3js SVG element and save using saveSvgAsPng.js
      saveSvgAsPng.saveSvgAsPng(
        document.getElementById("svg"),
        "Cell View.png",
        {
          scale: 2,
          backgroundColor: "#FFFFFF"
        }
      );
    });

    this.simulation.on("tick", this.onTick.bind(this));
  }

  onTick() {
    // Calculate the node's new position after applying the constraints
    const calculateNewPosition = node => {
      const component = this.cell[node.location];
      switch (node.location) {
        case "":
          return constraintOutsideCell(node.x, node.y, this.cell);
        case "cytoplasm":
          const components = Object.keys(this.cell)
            .filter(
              k =>
                !["plasma_membrane", "cytoplasm", "extracellular"].includes(k)
            )
            .filter(
              //additional filter for restricting cytoplasmic nodes from entering organelle membranes
              orgwithMembrane =>
                !this.props.groupMapping
                  .map(obj => obj.component)
                  .includes(orgwithMembrane)
            )
            .map(k => this.cell[k]);
          return constraintInsideCell(node.x, node.y, component, components);
        default:
          //const mycomp = Object.keys(this.cell);
          return constraintInsideCell(node.x, node.y, component);
      }
    };
    // Update node positions
    let node = this.node;

    let link = this.link;
    let props = this.props;

    this.node.each(function(d) {
      const result = calculateNewPosition(d);

      // Use character length to determine hover information
      let characterLength =
        (d.id.length < 6
          ? d.id.length + 2
          : d.id.length > 12
          ? d.id.length - 2
          : d.id.length) * 12;

      d3.select(this)
        .attr("cx", result.x)
        .attr("fixed", false)
        .attr("cy", result.y)

        .on("mouseover", function(d, i) {
          // Add the text background
          const linkedByIndex = {};
          props.data.links.forEach(d => {
            linkedByIndex[`${d.source.index},${d.target.index}`] = 1;
          });

          //Checks if the nodes are connected
          function isConnected(a, b) {
            return (
              linkedByIndex[`${a.index},${b.index}`] ||
              linkedByIndex[`${b.index},${a.index}`] ||
              a.index === b.index
            );
          }
          node.style("stroke-opacity", function(o) {
            const thisOpacity = isConnected(d, o) ? 1 : 0.1;
            this.setAttribute("fill-opacity", thisOpacity);
            return thisOpacity;
          });

          link.style("stroke-opacity", o =>
            o.source === d || o.target === d ? 1 : 0.1
          );

          d3.select(this.parentNode.parentNode) // This lets this component be drawn on top of other comoponents
            .append("rect")
            .classed("tooltip-wrapper", true)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("x", function() {
              // Adjust the center of the rectangle
              return result.x - characterLength / 2;
            }) // set x position of left side of rectangle
            .attr("y", result.y - 40) // set y position of top of rectangle
            .attr("width", function() {
              // The function returns width of the background based on the length of characters
              return characterLength;
            })
            .attr("height", 30)
            .attr("id", "node" + i);

          //Add the text description
          d3.select(this.parentNode.parentNode) // This lets this component be drawn on top of other comoponents
            .append("text")
            .classed("tooltip", true)
            .attr("x", result.x) // set x position of left side of text
            .attr("y", result.y) // set y position of bottom of text
            .attr("dy", "-20") // set offset y position
            .attr("text-anchor", "middle") // set anchor y justification
            .attr("id", "node" + i)
            .text(d.id);
        })
        .on("mouseout", function(d, i) {
          d3.selectAll("#node" + i).remove(); // Removes the on-hover information
          node.style("stroke-opacity", function(o) {
            this.setAttribute("fill-opacity", 1);
            return 1;
          });
          link.style("stroke-opacity", 0.3);
        });
    });
    // Update link
    this.link.each(function(d) {
      const sourcePosition = calculateNewPosition(d.source);
      const targetPosition = calculateNewPosition(d.target);
      d3.select(this)
        .attr("x1", sourcePosition.x)
        .attr("y1", sourcePosition.y)
        .attr("x2", targetPosition.x)
        .attr("y2", targetPosition.y);
    });
  }

  drag(simulation) {
    function dragstarted(d) {
      if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d) {
      if (!d3.event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  render() {
    return (
      <div
        id="svg_wrapper"
        style={{
          display: "grid",
          justifyContent: "center",
          alignContent: "center",
          height: "100vh"
        }}
      />
    );
  }
}
