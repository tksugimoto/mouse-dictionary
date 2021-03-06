import "babel-polyfill";
import React from "react";
import { render } from "react-dom";
import MouseDictionaryOptions from "./MouseDictionaryOptions";
import swal from "sweetalert";
import res from "./resources";
import dict from "./dict";

const KEY_LOADED = "**** loaded ****";

class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      encoding: "Shift-JIS",
      format: "EIJIRO",
      dictDataUsage: "-",
      busy: false,
      progress: ""
    };
    this.doChangeState = this.doChangeState.bind(this);
    this.doLoad = this.doLoad.bind(this);
    this.doClear = this.doClear.bind(this);
  }

  render() {
    const state = this.state;

    return (
      <MouseDictionaryOptions
        encoding={state.encoding}
        format={state.format}
        onChange={this.doChangeState}
        doLoad={this.doLoad}
        doClear={this.doClear}
        dictDataUsage={state.dictDataUsage}
        busy={this.state.busy}
        progress={this.state.progress}
      />
    );
  }

  componentDidMount() {
    this.updateDictDataUsage();

    chrome.storage.local.get(KEY_LOADED, r => {
      if (!r[KEY_LOADED]) {
        this.registerDefaultDict();
      }
    });
  }

  updateDictDataUsage() {
    if (chrome.storage.local.getBytesInUse) {
      chrome.storage.local.getBytesInUse(null, byteSize => {
        const kb = Math.floor(byteSize / 1024).toLocaleString();
        this.setState({
          dictDataUsage: res("dictDataUsage", kb)
        });
      });
    } else {
      // Firefox doesn't support getBytesInUse(at least 62.0)
      this.setState({ dictDataUsage: "" });
    }
  }

  async registerDefaultDict() {
    const willLoad = await swal({
      text: res("confirmLoadInitialDict"),
      icon: "info",
      buttons: true,
      closeOnClickOutside: false
    });

    if (willLoad) {
      this.setState({ busy: true });
      const { wordCount } = await dict.registerDefaultDict();

      this.updateDictDataUsage();
      const loaded = {};
      loaded[KEY_LOADED] = true;
      chrome.storage.local.set(loaded);
      this.setState({ busy: false, progress: "" });

      await swal({
        text: res("finishRegister", wordCount),
        icon: "success"
      });
    }
  }

  doChangeState(name, e) {
    if (name) {
      const newState = {};
      newState[name] = e.target.value;
      this.setState(newState);
    }
  }

  async doLoad() {
    const file = document.getElementById("dictdata").files[0];
    const encoding = this.state.encoding;
    const format = this.state.format;
    const event = ev => {
      switch (ev.name) {
        case "reading": {
          const loaded = ev.loaded.toLocaleString();
          const total = ev.total.toLocaleString();
          this.setState({ progress: `${loaded} / ${total} Byte` });
          break;
        }
        case "loading": {
          this.setState({ progress: res("progressRegister", ev.count, ev.word.head) });
          break;
        }
      }
    };
    if (file) {
      this.setState({ busy: true });
      const { wordCount } = await dict.load({ file, encoding, format, event });

      swal({
        text: res("finishRegister", wordCount),
        icon: "success"
      });
      const loaded = {};
      loaded[KEY_LOADED] = true;
      chrome.storage.local.set(loaded);

      this.updateDictDataUsage();
      this.setState({ busy: false, progress: "" });
    } else {
      swal({
        title: res("selectDictFile"),
        icon: "info"
      });
    }
  }

  doClear() {
    swal({
      text: res("clearAllDictData"),
      icon: "warning",
      buttons: true,
      dangerMode: true
    }).then(willDelete => {
      if (willDelete) {
        this.setState({ busy: true });

        chrome.storage.local.clear(() => {
          swal({
            text: res("finishedClear"),
            icon: "success"
          });
          this.setState({ busy: false });
          this.updateDictDataUsage();
        });
      }
    });
  }
}

window.onerror = msg => {
  swal({
    text: msg,
    icon: "error"
  });
};

render(<Main />, document.getElementById("app"));
