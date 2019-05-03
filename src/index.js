import React, { Component, Fragment } from "react";
import { fetchGraphData } from "./utils";
import ReactDOM from "react-dom";
import CellVisualizer from "./CellVisualizer";
import { PercentageChart } from "./PercentageChart";
import FileUpload from "./FileUpload";
import OrganelleDescription from "./OrganelleDescription";
import { Button, Input, Icon } from "antd";
import "antd/dist/antd.css";
import "./style.css";
import { AutoComplete } from "antd";

// Map a group of nodes to the cellular component (organnel) they belong to and their fill color
const GroupMapping = [
  { group: 0, color: "#740b28", component: "extracellular" },
  { group: 1, color: "#978cbf", component: "cytoplasm" },
  { group: 2, color: "#da950c", component: "endosome" },
  { group: 3, color: "#367baf", component: "glyoxysome" },
  { group: 4, color: "#ed2cbb", component: "centrosome" },
  { group: 5, color: "#23903a", component: "peroxisome" },
  { group: 6, color: "#4ecbb1", component: "plasma_membrane" },
  { group: 7, color: "#aa873c", component: "glycosome" },
  { group: 8, color: "#605294", component: "mtoc" },
  { group: 9, color: "#c71f25", component: "cell_wall" },
  { group: 10, color: "#c8ee2a", component: "chloroplast" },
  { group: 11, color: "#740b28", component: "apicoplast" },
  { group: 13, color: "#978cbf", component: "amyloplast" },
  { group: 14, color: "#da950c", component: "golgi_apparatus" },
  { group: 15, color: "#367baf", component: "endoplasmic_reticulum" },
  { group: 16, color: "#ed2cbb", component: "plastid" },
  { group: 17, color: "#23903a", component: "mitochondrion" },
  { group: 18, color: "#4ecbb1", component: "lysosome" },
  { group: 19, color: "#aa873c", component: "vacuole" },
  { group: 19, color: "#aa873c", component: "nucleus" }
];

export class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: undefined,
      selectedNode: undefined,
      selectedFile: null,
      selectedFileList: [],
      size: "large"
    };

    this.handleNodeSelected = this.handleNodeSelected.bind(this);
    this.handleFileUploaded = this.handleFileUploaded.bind(this);
    this.handleUploadedFileList = this.handleUploadedFileList.bind(this);
  }

  componentDidMount() {}

  handleUploadedFileList(file) {
    this.setState({
      selectedFile: file,
      selectedFileList: [file]
    });
  }
  handleFileUploaded(data) {
    this.setState({ data });
  }

  handleNodeSelected(node) {
    this.setState({ selectedNode: node });
  }

  renderVisualization() {
    const data = GroupMapping.map(m => {
      const d = Object.assign({}, m);
      d.value =
        this.state.data.nodes.filter(n => n.group === d.group).length /
        this.state.data.nodes.length;
      d.label = d.component;
      return d;
    });
    return (
      <div
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column"
        }}
      >
        <CellVisualizer
          selectedNode={this.state.selectedNode}
          groupMapping={GroupMapping}
          data={this.state.data}
          onNodeSelected={this.handleNodeSelected}
        />

        {this.state.selectedNode && (
          <OrganelleDescription
            selectedNode={this.state.selectedNode}
            onNodeSelected={this.handleNodeSelected}
          />
        )}
        <div style={{ position: "absolute", bottom: 0, width: 600 }}>
          <PercentageChart data={data} />
        </div>
      </div>
    );
  }

  render() {
    return this.state.data ? (
      <Fragment>
        <div style={{ right: 15, bottom: 15, position: "absolute" }}>
          <Button id="download" type="primary" icon="download" size={"large"}>
            Download
          </Button>
        </div>

        <FileUpload
          fileList={this.state.selectedFileList}
          onFileUploaded={this.handleFileUploaded}
          handleFileList={this.handleUploadedFileList}
        />
        <div
          style={{
            width: "100vw",
            textAlign: "center",
            position: "absolute",
            top: 15
          }}
        >
          <AutoComplete
            dataSource={this.state.data.nodes.map(d => d.id)}
            placeholder="input here"
            style={{ width: 600 }}
            onSelect={selectedId => {
              this.handleNodeSelected(
                this.state.data.nodes.find(n => n.id === selectedId)
              );
            }}
            filterOption={(inputValue, option) =>
              option.props.children
                .toUpperCase()
                .indexOf(inputValue.toUpperCase()) !== -1
            }
          />
        </div>
        {this.renderVisualization()}
      </Fragment>
    ) : (
      <div
        style={{
          display: "grid",
          justifyContent: "center",
          alignContent: "center",
          height: "60vh"
        }}
      >
        <h1 style={{ textAlign: "center", color: "hsla(0, 0%, 25%, 1)" }}>
          Cell Visualizer
        </h1>
        <FileUpload
          fileList={this.state.selectedFileList}
          onFileUploaded={this.handleFileUploaded}
          handleFileList={this.handleUploadedFileList}
        />
      </div>
    );
  }
}

ReactDOM.render(<App />, document.getElementById("app"));
