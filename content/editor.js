/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 * Creator:
 *   Girish Sharma <scrapmachines@gmail.com>
 */

"use strict";
let global = this;
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const {require} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools;
var Editor;
try {
  // Firefox 44+
  Editor = require("devtools/client/sourceeditor/editor");
} catch (ex) {
  Editor = require("devtools/sourceeditor/editor");
}
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("chrome://userstylemanager-scripts/content/shared.jsm");

function getFileURI(path) {
  return path.indexOf("file") == 0
           ? ios.newURI(path, null, null)
           : getURIForFileInUserStyles(path.replace(/^(styles\/)/, ""));
}

["helper", "pref", "main", "cssbeautify"].forEach(function(fileName) {
  let fileURL = "chrome://userstylemanager-scripts/content/" + fileName + ".js";
  Services.scriptloader.loadSubScript(fileURL, global);
});

// Namespace const
const NAMESPACE = {
  xul: 0,
  xhtml: 1,
  none: 2,
};

// constant list of css attributes
const CSSKeywordsList = [
  "-moz-animation", "-moz-animation-delay", "-moz-animation-direction",
  "-moz-animation-duration", "-moz-animation-fill-mode",
  "-moz-animation-iteration-count", "-moz-animation-name",
  "-moz-animation-play-state", "-moz-animation-timing-function",
  "-moz-appearance", "-moz-backface-visibility", "-moz-background-inline-policy",
  "-moz-binding", "-moz-border-bottom-colors", "-moz-border-end",
  "-moz-border-end-color", "-moz-border-end-style", "-moz-border-end-width",
  "-moz-border-image", "-moz-border-image-outset", "-moz-border-image-repeat",
  "-moz-border-image-slice", "-moz-border-image-source", "-moz-border-image-width",
  "-moz-border-left-colors", "-moz-border-right-colors", "-moz-border-start",
  "-moz-border-start-color", "-moz-border-start-style", "-moz-border-start-width",
  "-moz-border-top-colors", "-moz-box-align", "-moz-box-direction",
  "-moz-box-flex", "-moz-box-ordinal-group", "-moz-box-orient", "-moz-box-pack",
  "-moz-box-sizing", "-moz-column-count", "-moz-column-fill", "-moz-column-gap",
  "-moz-column-width", "-moz-column-rule", "-moz-column-rule-style",
  "-moz-column-rule-color", "-moz-float-edge", "-moz-font-feature-settings",
  "-moz-font-language-override", "-moz-force-broken-image-icon",
  "-moz-hyphens", "-moz-image-region", "-moz-margin-end", "-moz-margin-start",
  "-moz-orient", "-moz-outline-radius", "-moz-outline-radius-bottomleft",
  "-moz-outline-radius-bottomright", "-moz-outline-radius-topleft",
  "-moz-outline-radius-topright", "-moz-padding-end", "-moz-padding-start",
  "-moz-perspective", "-moz-perspective-origin", "-moz-script-level",
  "-moz-script-min-size", "-moz-script-size-multiplier", "-moz-stack-sizing",
  "-moz-text-align-last", "-moz-text-blink", "-moz-text-decoration-color",
  "-moz-text-decoration-line", "-moz-text-decoration-style", "-moz-transform",
  "-moz-transform-origin", "-moz-transform-style", "-moz-transition",
  "-moz-transition-delay", "-moz-transition-duration", "-moz-transition-property",
  "-moz-transition-timing-function", "-moz-user-focus", "-moz-user-input",
  "-moz-user-modify", "-moz-user-select", "-moz-window-shadow",
  "alignment-adjust", "alignment-baseline", "animation", "animation-delay",
  "animation-direction", "animation-duration", "animation-iteration-count",
  "animation-name", "animation-play-state", "animation-timing-function",
  "appearance", "azimuth", "backface-visibility", "background",
  "background-attachment", "background-clip", "background-color",
  "background-image", "background-origin", "background-position",
  "background-repeat", "background-size", "baseline-shift", "binding", "bleed",
  "bookmark-label", "bookmark-level", "bookmark-state", "bookmark-target",
  "border", "border-bottom", "border-bottom-color", "border-bottom-left-radius",
  "border-bottom-right-radius", "border-bottom-style", "border-bottom-width",
  "border-collapse", "border-color", "border-image", "border-image-outset",
  "border-image-repeat", "border-image-slice", "border-image-source",
  "border-image-width", "border-left", "border-left-color", "border-left-style",
  "border-left-width", "border-radius", "border-right", "border-right-color",
  "border-right-style", "border-right-width", "border-spacing", "border-style",
  "border-top", "border-top-color", "border-top-left-radius",
  "border-top-right-radius", "border-top-style", "border-top-width",
  "border-width", "bottom", "box-decoration-break", "box-shadow", "box-sizing",
  "break-after", "break-before", "break-inside", "caption-side", "clear", "clip",
  "clip-path", "color", "color-profile", "column-count", "column-fill",
  "column-gap", "column-rule", "column-rule-color", "column-rule-style",
  "column-rule-width", "column-span", "column-width", "columns", "content",
  "counter-increment", "counter-reset", "crop", "cue", "cue-after", "cue-before",
  "cursor", "direction", "display", "dominant-baseline",
  "drop-initial-after-adjust", "drop-initial-after-align",
  "drop-initial-before-adjust", "drop-initial-before-align", "drop-initial-size",
  "drop-initial-value", "elevation", "empty-cells", "filter",
  "fit", "fit-position", "flex-align", "flex-flow", "flex-line-pack",
  "flex-order", "flex-pack", "float", "float-offset", "font", "font-family",
  "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant",
  "font-weight", "grid-columns", "grid-rows", "hanging-punctuation", "height",
  "hyphenate-after", "hyphenate-before", "hyphenate-character", "hyphenate-lines",
  "hyphenate-resource", "hyphens", "icon", "image-orientation", "image-rendering",
  "image-resolution", "inline-box-align", "left", "letter-spacing", "line-break",
  "line-height", "line-stacking", "line-stacking-ruby", "line-stacking-shift",
  "line-stacking-strategy", "list-style", "list-style-image",
  "list-style-position", "list-style-type", "margin", "margin-bottom",
  "margin-left", "margin-right", "margin-top", "marker-offset", "marks",
  "marquee-direction", "marquee-loop", "marquee-play-count", "marquee-speed",
  "marquee-style", "mask", "max-height", "max-width", "min-height", "min-width",
  "move-to", "nav-down", "nav-index", "nav-left", "nav-right", "nav-up",
  "opacity", "orphans", "outline", "outline-color", "outline-offset",
  "outline-style", "outline-width", "overflow", "overflow-style", "overflow-wrap",
  "overflow-x", "overflow-y", "padding", "padding-bottom", "padding-left",
  "padding-right", "padding-top", "page", "page-break-after", "page-break-before",
  "page-break-inside", "page-policy", "pause", "pause-after", "pause-before",
  "perspective", "perspective-origin", "phonemes", "pitch", "pitch-range",
  "play-during", "pointer-events", "position", "presentation-level",
  "punctuation-trim", "quotes", "rendering-intent", "resize", "rest",
  "rest-after", "rest-before", "richness", "right", "rotation", "rotation-point",
  "ruby-align", "ruby-overhang", "ruby-position", "ruby-span", "size", "speak",
  "speak-header", "speak-numeral", "speak-punctuation", "speech-rate", "stress",
  "string-set", "tab-size", "table-layout", "target", "target-name", "target-new",
  "target-position", "text-align", "text-align-last", "text-decoration",
  "text-decoration-color", "text-decoration-line", "text-decoration-skip",
  "text-decoration-style", "text-emphasis", "text-emphasis-color",
  "text-emphasis-position", "text-emphasis-style", "text-height", "text-indent",
  "text-justify", "text-outline", "text-shadow", "text-space-collapse",
  "text-transform", "text-underline-position", "text-wrap", "top", "transform",
  "transform-origin", "transform-style", "transition", "transition-delay",
  "transition-duration", "transition-property", "transition-timing-function",
  "unicode-bidi", "vertical-align", "visibility", "voice-balance",
  "voice-duration", "voice-family", "voice-pitch", "voice-pitch-range",
  "voice-rate", "voice-stress", "voice-volume", "volume", "white-space", "widows",
  "width", "word-break", "word-spacing", "word-wrap", "z-index"
];

const RGB_HSLA_MATCH = '(rgba?|hsla?)[ ]{0,}\\(([0-9 .]+,[0-9% .]+,[0-9% .]+,?[0-9 .]{0,})\\)';
const HEX_MATCH = '(#)([0-9abcdef]{3,9})';
const URL_MATCH = 'url\\s{0,}\\((([\'\"]?([^\'\"\\)]{0,})[\'\"]?){0,}([ \\n]' +
                  '{0,}\\+[^\\+]+\\+[ \\n]{0,}){0,}([\'\"]?([^\'\"\\)]{0,})[\'\"]?){0,}){0,}\\)';

function StyleEditor() {
  this.win = window;
  this.doc = document;
  // Bindings
  this.inputHelper = this.inputHelper.bind(this);
  this.postInputHelper = this.postInputHelper.bind(this);
  this.preInputHelper = this.preInputHelper.bind(this);
  this.onMouseMove = this.onMouseMove.bind(this);
  this.onMouseClick = this.onMouseClick.bind(this);
  this.onDblClick = this.onDblClick.bind(this);
  this.onTextChanged = this.onTextChanged.bind(this);
  this.onLoad = this.onLoad.bind(this);
  this.onUnload = this.onUnload.bind(this);
  this.onClose = this.onClose.bind(this);
  this.doFind = this.doFind.bind(this);
  this.doNewFind = this.doNewFind.bind(this);
  this.doFindPrevious = this.doFindPrevious.bind(this);
  this.doReplace = this.doReplace.bind(this);
  this.undo = this.undo.bind(this);
  this.redo = this.redo.bind(this);
  this.beautify = this.beautify.bind(this);
  this.previewButtonClick = this.previewButtonClick.bind(this);
  this.saveButtonClick = this.saveButtonClick.bind(this);
  this.exitButtonClick = this.exitButtonClick.bind(this);
  this.addNamespace = this.addNamespace.bind(this);
  this.addWebNamespace = this.addWebNamespace.bind(this);
  this.addMozURL = this.addMozURL.bind(this);
  this.addMozPreURL = this.addMozPreURL.bind(this);
  this.addMozDomain = this.addMozDomain.bind(this);
  this.onToolsMenuShowing = this.onToolsMenuShowing.bind(this);
  this.onToolsMenuHiding = this.onToolsMenuHiding.bind(this);
  this.onSearchFocus = this.onSearchFocus.bind(this);
  this.onSearchBlur = this.onSearchBlur.bind(this);
  this.searchPanelHidden = this.searchPanelHidden.bind(this);
  this.closeReplace = this.closeReplace.bind(this);
  this.onReplaceFocus = this.onReplaceFocus.bind(this);
  this.onReplaceBlur = this.onReplaceBlur.bind(this);
  this.closeErrorPanel = this.closeErrorPanel.bind(this);
  this.autocompletePanelPress = this.autocompletePanelPress.bind(this);
  this.autocompletePanelOpen = this.autocompletePanelOpen.bind(this);

  this._init();
}

StyleEditor.prototype = {
  initialized: false,
  saved: false,
  savedOnce: false,
  createNew: false,
  openNew: false,
  styleSheetFile: null,
  index: -1,
  styleName: "",
  updateURL: "",
  options: "",
  previewShown: false,
  origPath: "",
  origEnabled: "",
  stylePath: "",
  initialText: "",
  lastFind: "",
  regexpIndex: 0,
  replaceVisible: false,
  searchVisible: false,
  lastReplacedIndex: -1,
  caretPosLine: 0,
  caretPosCol: 0,
  strings: null,
  color: [],
  colorCaretOffset: -1,
  colorMatch: '',
  namespace: null,
  get codeBlockStyle() {
    if (this._codeBlockStyle) {
      return this._codeBlockStyle;
    }
    this._codeBlockStyle = JSON.parse(pref("editingOptions")).codeBlockStyle;
    return this._codeBlockStyle;
  },

  // Call back function to be called when closing the editor
  callback: null,

  $: function SE_$(id) {
    return this.doc.getElementById(id);
  },

  _init: function SE__init() {
    XPCOMUtils.defineLazyGetter(this, "strings", function () {
      return Services.strings.createBundle("chrome://userstylemanager/locale/styleeditor.properties");
    });
  },

  selectedText: function SE_selectedText() {
    return this.editor.getSelection();
  },

  selectRange: function SE_selectRange(aStart, aEnd) {
    this.editor.setSelection(this.editor.getPosition(aStart),
                             this.editor.getPosition(aEnd));
  },

  getSelectionPoints: function SE_getSelectionPoints() {
    return [this.editor.getOffset(this.editor.getCursor("start")),
            this.editor.getOffset(this.editor.getCursor("end"))];
  },

  getCaretLine: function SE_getCaretLine() {
    return this.editor.getCursor().line;
  },

  getText: function SE_getText() {
    return this.editor.getText();
  },

  // Function to read the localized strings
  STR: function SE_STR(aString) {
    return this.strings.GetStringFromName(aString);
  },

  setText: function SE_setText(aText, aStart, aEnd) {
    if (aStart == null) {
      aStart = 0;
    }
    if (aEnd == null) {
      aEnd = this.getText().length;
    }
    this.editor.replaceText(aText, this.editor.getPosition(aStart),
                            this.editor.getPosition(aEnd));
  },

  setStyleName: function SE_setStyleName(aStyleName) {
    this.styleName = aStyleName;
  },

  setTitle: function SE_setTitle(aTitle) {
    this.doc.title = unescape(aTitle);
  },

  // Function to convert mouse click coordinates (screenX, screenY) into offset
  getOffsetAtLocation: function SE_getOffsetAtLocation(aX, aY) {
    return this.editor.getOffset(this.editor.getPositionFromCoords({left: aX, top: aY}));
  },

  // Function to convert offset into X,Y coordinates
  getLocationAtOffset: function SE_getLocationAtOffset(aOffset) {
    let {top, left} = this.editor.getCoordsFromPosition(this.editor.getPosition(aOffset));
    return {x: left, y: top};
  },

  resetVariables: function SE_resetVariables() {
    this.styleSheetFile = null;
    this.initialized = false;
    this.doc = null;
    // Resetting the preferences used for manually adding search engine
    Services.prefs.clearUserPref("extensions.UserStyleManager.editorOpen");
  },

  fixupText: function SE_fixupText() {
    let text = this.getText();
    return text.replace(/![importan]{0,10}\s{0,};/gi,"!important;");
  },

  //  function to handle click/enter on the panel
  autocompletePanelPress: function SE_autocompletePanelPress(event) {
    if (event.button && event.button == 0 ||
        event.keyCode == event.DOM_VK_ENTER ||
        event.keyCode == event.DOM_VK_RETURN) {
      if (this.$("USMAutocompletePanel").state == "open") {
        if (this.$("USMAutocompleteList").selectedItem) {
          let value = this.$("USMAutocompleteList").selectedItem.lastChild.value + ": ";
          this.$("USMAutocompletePanel").hidePopup();
          this.editor.focus();
          event.stopPropagation();
          event.preventDefault();
          this.editor.setCursor({line: this.caretPosLine, ch: this.caretPosCol});
          let caretOffset = this.getCaretOffset();
          this.setText(value, caretOffset, caretOffset);
        }
      }
    }
  },

  //  function to handle opening of autocomplete panel
  autocompletePanelOpen: function SE_autocompletePanelOpen() {
    this.$("USMAutocompleteList").currentIndex = this.$("USMAutocompleteList").selectedIndex = 0;
  },

  preInputHelper: function SE_preInputHelper(event) {
    if (event.keyCode != event.DOM_VK_DOWN &&
        event.keyCode != event.DOM_VK_UP) {
      return;
    }
    let [start, end] = this.getSelectionPoints();
    let text = this.getText();
    switch (event.keyCode) {
      case event.DOM_VK_DOWN:
        // move to end of line if at last line
        if (text.slice(end).indexOf("\n") == -1) {
          if (end > start && event.shiftKey && start > -1) {
            this.selectRange(start, text.length);
          }
          else if (event.shiftKey) {
            this.selectRange(end, text.length);
          }
          else {
            this.setCaretOffset(text.length);
          }
        }
        if (this.$("USMColorPickerPanel").state == "open") {
          this.$("USMColorPickerPanel").hidePopup();
          return;
        }
        break;
      case event.DOM_VK_UP:
        if (text.slice(0, start).indexOf("\n") == -1) {
          if (end > start && event.shiftKey && start > -1) {
            this.selectRange(end, 0);
          }
          else if (event.shiftKey) {
            this.selectRange(start, 0);
          }
          else {
            this.setCaretOffset(0);
          }
        }
        if (this.$("USMColorPickerPanel").state == "open") {
          this.$("USMColorPickerPanel").hidePopup();
          return;
        }
        break;
    }
  },

  inputHelper: function SE_inputHelper(key) {
    let pass = this.editor.container.contentWindow.wrappedJSObject.CodeMirror.Pass;
    switch (key) {
      case "up":
        if (this.$("USMAutocompletePanel").state == "open") {
          if (this.$("USMAutocompleteList").currentIndex == 0) {
            this.$("USMAutocompleteList").currentIndex =
              this.$("USMAutocompleteList").selectedIndex =
              this.$("USMAutocompleteList").itemCount - 1;
          }
          else {
            this.$("USMAutocompleteList").currentIndex--;
            this.$("USMAutocompleteList").selectedIndex--;
          }
          this.editor.setCursor({line: this.caretPosLine, ch: this.caretPosCol});
          return;
        }
        return pass;
      case "down":
        if (this.$("USMAutocompletePanel").state == "open") {
          if (this.$("USMAutocompleteList").currentIndex ==
                this.$("USMAutocompleteList").itemCount - 1) {
            this.$("USMAutocompleteList").currentIndex =
              this.$("USMAutocompleteList").selectedIndex = 0;
          }
          else {
            this.$("USMAutocompleteList").currentIndex++;
            this.$("USMAutocompleteList").selectedIndex++;
          }
          this.editor.setCursor({line: this.caretPosLine, ch: this.caretPosCol});
          return;
        }
        return pass;
      case "other":
        if (this.$("USMAutocompletePanel").state == "open") {
          this.$("USMAutocompletePanel").hidePopup();
        }
        return pass;
      case "tab":
        if (this.$("USMAutocompletePanel").state == "open") {
          if (this.$("USMAutocompleteList").selectedItem) {
            let value = this.$("USMAutocompleteList").selectedItem.lastChild.value + ": ";
            this.$("USMAutocompletePanel").hidePopup();
            let currentPos = this.getCaretOffset();
            this.setText(value, currentPos, currentPos);
          }
          return;
        }
        return pass;
      case "enter":
        if (this.$("USMAutocompletePanel").state == "open") {
          if (this.$("USMAutocompleteList").selectedItem) {
            this.editor.setCursor({line: this.caretPosLine, ch: this.caretPosCol});
            let currentPos = this.getCaretOffset();
            this.setText(this.$("USMAutocompleteList").selectedItem.lastChild.value +
                          ": ", currentPos, currentPos);
            this.$("USMAutocompletePanel").hidePopup();
          }
          return;
        }
        return pass;
    }
  },

  postInputHelper: function SE_postInputHelper(event) {
    switch (event.keyCode) {
      case event.DOM_VK_CONTROL:
      case event.DOM_VK_ALT:
      case event.DOM_VK_SHIFT:
      case event.DOM_VK_DELETE:
      case event.DOM_VK_BACK_SPACE:
      case event.DOM_VK_HOME:
      case event.DOM_VK_END:
      case event.DOM_VK_ESCAPE:
      case event.DOM_VK_TAB:
        return;
      case event.DOM_VK_UP:
      case event.DOM_VK_DOWN:
      case event.DOM_VK_LEFT:
      case event.DOM_VK_RIGHT: {
          let currentPos = this.getCaretOffset();
          let text = this.getText();
          let textBefore = text.slice(0, currentPos);
          if (textBefore.match(/\n[ \n]{0,}\}[ \n]{0,}$/) &&
              textBefore.lastIndexOf("{") <
                textBefore.lastIndexOf("\n", textBefore.lastIndexOf("}"))) {
            let match =
              textBefore.match(/([ ]{0,})[^\n^\{]{0,}\{[^\{\}]{0,}\n([^\n\}]{0,})\}[ \n]{0,}$/);
            if (match) {
              let indent = match[1].length;
              let indentation = "";
              for (let i = 0; i < indent; i++) {
                indentation += " ";
              }
              if (match[2].length != indent) {
                this.setText(indentation, currentPos - match[2].length - 1, currentPos - 1);
                this.setCaretOffset(currentPos - match[2].length + indent);
              }
            }
          }
        }
        return;
      case event.DOM_VK_ENTER:
      case event.DOM_VK_RETURN: {
          let currentPos = this.getCaretOffset();
          let text = this.getText();
          let textAfter = text.slice(currentPos);
          let textBefore = text.slice(0, currentPos);
          if (textBefore.lastIndexOf("{") > textBefore.lastIndexOf("}") &&
              textBefore.match(/\{[^\{\n]{0,}\n[ ]{0,}$/)) {
            let indent = Services.prefs.getIntPref("devtools.editor.tabsize");
            let indentation = "";
            for (let i = 0; i < indent; i++) {
              indentation += " ";
            }
            this.setText(indentation, currentPos, currentPos);
            this.setCaretOffset(currentPos + indent);
          }
        }
        return;
    }

    if (event.ctrlKey || event.altKey || event.metaKey) {
      if (this.$("USMAutocompletePanel").state == "open") {
        this.$("USMAutocompletePanel").hidePopup();
      }
      return;
    }

    if (this.selectedText().length > 0) {
      return;
    }

    let currentPos = this.getCaretOffset();
    let text = this.getText();
    let matchedList = [];
    let lastWord = text.slice(currentPos - 1, currentPos);
    // check if the types word is !
    if ("!" == lastWord) {
      // checking whether we are not inside a comment
      let textBefore = text.slice(0, currentPos - 1);
      if (textBefore.lastIndexOf("\/*") > textBefore.lastIndexOf("*\/")) {
        return;
      }
      let textAfter = text.slice(currentPos, currentPos + 9);
      if (textAfter.length == 0 ||
          textAfter.toLowerCase() != "important".slice(0, textAfter.length)) {
        this.setText('!important' + (textAfter[0] != ';'? ';': ''),
                     currentPos - 1,
                     currentPos);
      }
    }
    else if (text.slice(0, currentPos).split("\n").slice(-1)[0].split("'").length%2 &&
             text.slice(0, currentPos).split("\n").slice(-1)[0].split('"').length%2) {
      if ("/*" == text.slice(currentPos - 2, currentPos)) {
        let textAfter = text.slice(currentPos);
        if ((textAfter.split("*/").length == 1 ||
             textAfter.split("*/")[0].split("/*").length != 1) &&
            (textAfter.match(/^[ ]{0,}\n/) ||
             textAfter.match(/^[ ]{0,}$/))) {
          this.setText("*/", currentPos, currentPos);
          this.setCaretOffset(currentPos);
        }
      }
      // Case for color picker as you type
      else if (("(" == lastWord || "#" == lastWord) &&
               text.slice(0, currentPos).match(/(rgba?\s*\(|#)$/)) {
        let match = text.slice(0, currentPos).match(/(rgba?\s*\()|(#)$/), color;
        let panel = document.getElementById("USMColorPickerPanel");
        if (match && match[2] != "#") {
          let alpha = match[1].length > 4;
          this.setText("150, 150, 150" + (alpha?", 1":""),
                       currentPos,
                       currentPos);
          color = [150,150,150];
        }
        else if (match && match[2] == "#") {
          let lineBefore = text.slice(0, currentPos).match(/\n?[^\n]*$/)[0];
          let property = lineBefore.match(/\s*([a-zA-Z\-]+)\s*:[^:]*$/);
          if (!property) {
            return;
          }
          property = property[1];
          if (CSSKeywordsList.indexOf(property.toLowerCase()) < 0) {
            return;
          }
          this.setText("DDDDDD", currentPos, currentPos);
          color = "DDDDDD";
        }
        else if (!match) {
          return;
        }
        this.colorCaretOffset = currentPos - match[0].length;
        this.colorMatch = match[2] != "#"? RGB_HSLA_MATCH: HEX_MATCH;
        this.color = color;
        //colorPicker(e,mode,size,rO/*readOnly*/,offsetX,offsetY,orientation
        //,parentObj,parentXY,color,difPad,rSpeed,docBody,onColorSave,onColorChange)
        colorPicker(event, 'B', 3, false, null, null, null, panel, null, color,
                    null, null, panel, this.onColorPickerSave.bind(this));
        let screen = this.getLocationAtOffset(currentPos - match[0].length);
        if (panel.state == "open") {
          panel.moveTo(screen.x + this.editor.container.boxObject.screenX,
                       screen.y + 15 + this.editor.container.boxObject.screenY);
        }
        else {
          panel.openPopupAtScreen(screen.x + this.editor.container.boxObject.screenX,
                                  screen.y + 15 + this.editor.container.boxObject.screenY, false);
        }
        listen(window, panel, "popuphidden", function() {
          this.colorCaretOffset = -1;
          this.colorMatch = '';
          this.color = [];
          this.editor.focus();
        }.bind(this));
      }
      else {
        let richlist = this.$("USMAutocompleteList");
        try {
          while (richlist.firstChild) {
            richlist.removeChild(richlist.firstChild);
          }
        } catch (ex) {}
        // Checking for autocompleting
        let textBefore = text.slice(0, currentPos);
        let word = textBefore.match(/([0-9a-zA-Z_\-]+)$/);
        let colNum = this.editor.getCursor().ch;
        this.caretPosCol = colNum;
        let lineNum = this.editor.getCursor().line;
        this.caretPosLine = lineNum;
        if (!word) {
          try {
            this.$("USMAutocompletePanel").hidePopup();
          } catch (ex) {}
          return;
        }
        word = word[1];
        let lineBefore = textBefore.slice(-colNum).slice(0, colNum - word.length);
        let numTabs = lineBefore.split("\t").length - 1;
        colNum += numTabs*(Services.prefs.getIntPref("devtools.editor.tabsize") - 1);
        for (let i = 0; i < CSSKeywordsList.length; i++) {
          if (CSSKeywordsList[i].slice(0, word.length).toLowerCase() != word.toLowerCase()) {
            continue;
          }
          matchedList.push(CSSKeywordsList[i]);
        }
        if (matchedList.length == 0) {
          if (this.$("USMAutocompletePanel").state == "open") {
            this.$("USMAutocompletePanel").hidePopup();
          }
          return;
        }
        let maxLen = 0;
        for (let i = 0; i < matchedList.length; i++) {
          if (maxLen < matchedList[i].length) {
            maxLen = matchedList[i].length;
          }
          let item = document.createElementNS(XUL, "richlistitem");
          let matchingPart = document.createElementNS(XUL, "label");
          matchingPart.setAttribute("value", word);
          matchingPart.setAttribute("style", "margin: 2px 0px; font-family: " +
                                    "monospace; font-size: inherit; font-size: 14px;");
          item.appendChild(matchingPart);
          let rest = document.createElementNS(XUL, "label");
          rest.setAttribute("value", matchedList[i].slice(word.length));
          rest.setAttribute("style", "color: #444; margin: 2px 0px; font-family:" +
                            "monospace; font-size: inherit; font-size: 14px;");
          item.appendChild(rest);
          richlist.appendChild(item);
        }
        // Convert the caret position into x,y coordinates.
        let lineHeight = 17;
        let {x, y} = this.getLocationAtOffset(currentPos - word.length);
        x += this.editor.container.boxObject.screenX;
        y += this.editor.container.boxObject.screenY + lineHeight;
        this.$("USMAutocompleteList").setAttribute("height",
                                                   Math.min(matchedList.length*20 + 15, 250));
        this.$("USMAutocompleteList").setAttribute("width", (maxLen*8 + 30));
        if (this.$("USMAutocompletePanel").state == "open") {
          this.$("USMAutocompletePanel").moveTo(x, y);
        }
        else {
          this.$("USMAutocompletePanel").openPopupAtScreen(x, y, false);
        }
        // Shifting the popup above one line if not enough space below
        if (y + this.$("USMAutocompletePanel").boxObject.height > window.screen.height) {
          y -= (lineHeight + this.$("USMAutocompletePanel").boxObject.height);
          this.$("USMAutocompletePanel").moveTo(x, y);
        }
        this.$("USMAutocompleteList").focus();
        this.$("USMAutocompleteList").currentIndex =
          this.$("USMAutocompleteList").selectedIndex = 0;
        this.editor.focus();
        this.setCaretOffset(currentPos);
      }
    }
  },

  onDblClick: function SE_onDblClick(event) {
    let panel = this.$("USMPreviewPanel");
    if (this.$("USMColorPickerPanel").state == "open") {
      panel.hidePopup();
      return;
    }
    let offset = this.getOffsetAtLocation(event.pageX, event.pageY), startIndex;
    let text = this.getText();
    let match = Math.max(text.slice(0, offset).lastIndexOf('url('), text.slice(0, offset).lastIndexOf('url ('));
    if (match == -1) {
      panel.hidePopup();
      return;
    }
    else {
      startIndex = match;
    }
    match = text.slice(startIndex).match(new RegExp('^' + URL_MATCH, 'i'));
    if (match[0].length < offset - startIndex) {
      panel.hidePopup();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.setCaretOffset(offset);
    let url = match[1].replace(/[\n ]{0,}/g, "")
                      .replace(/['"]\+{0,}['"]/g, "")
                      .replace(/^['"]/, "")
                      .replace(/['"]$/, "");

    this.$("USMPreviewPanelImage").style.display = "none";
    panel.removeAttribute("class");
    panel.setAttribute("style", "min-width: 150px !important; min-height: 150px" +
                       " !important; background-size:100% 100%; background-image: url(" +
                       url + ")");

    if (panel.state == "closed") {
      panel.openPopupAtScreen(event.screenX, event.screenY, false);
    }
    else {
      panel.moveTo(event.screenX, event.screenY);
    }
  },

  onMouseMove: function SE_onMouseMove(event) {
    let panel = this.$("USMPreviewPanel");
    if (this.$("USMColorPickerPanel").state == "open") {
      panel.hidePopup();
      return;
    }
    let offset = this.getOffsetAtLocation(event.pageX, event.pageY);
    let text = this.getText();
    if (text.length < 4) {
      return;
    }
    let rgbhslaMatch = false, color;
    let match = text.slice(0, offset).match(/(r|rg|rgb|rgba|h|hs|hsl|hsla)[ ,0-9%.\)\(]{0,}$/);
    if (!match) {
      match = text.slice(0, offset).match(/(#)[0-9abcdef]{0,6}$/i);
    }
    if (!match) {
      panel.hidePopup();
      return;
    }
    let startIndex = offset - match[0].length;
    // Check to allow only the colors after :
    if (text.slice(0, startIndex).split("\n").slice(-1)[0].indexOf(":") == -1) {
      panel.hidePopup();
      return;
    }
    text = text.slice(startIndex);
    match = text.match(new RegExp(RGB_HSLA_MATCH, 'i'));
    if (!match) {
      match = text.match(new RegExp(HEX_MATCH, 'i'));
    }
    else {
      rgbhslaMatch = true;
    }
    if (!match) {
      panel.hidePopup();
      return;
    }
    // Updating startIndex to be accurate
    startIndex += rgbhslaMatch
                    ? text.search(new RegExp(RGB_HSLA_MATCH, 'i'))
                    : text.search(new RegExp(HEX_MATCH, 'i'));
    // this.caretPosCol = text.slice(0, startIndex).match(/\n?.{0,}$/).length;
    // this.caretPosLine = text.slice(0, startIndex).split("\n").length - 1;
    let screen = this.getLocationAtOffset(startIndex);
    if ((screen.x - event.pageX) > 20 ||
        (screen.x - event.pageX) < -8*match[0].length ||
        (screen.y - event.pageY) > 25 ||
        (screen.y - event.pageY) < -15) {
      panel.hidePopup();
      return;
    }
    if (rgbhslaMatch && match[2]) {
      let len = match[2].split(",").length;
      if (len == 3 || len == 4) {
        color = match[2].replace(/[ %]{0,}/g, "").split(",").map(function(s) {
          return Math.round(parseFloat(s));
        });
        if (color.length == 4) {
          color.pop();
        }
      }
      else {
        panel.hidePopup();
        return;
      }
    }
    else if (!rgbhslaMatch && match[2]) {
      color = match[2];
      if (color.length%3 != 0) {
        panel.hidePopup();
        return;
      }
    }
    else {
      panel.hidePopup();
      return;
    }
    this.setPreviewImage(this.regexp2RGB(match, color, color, color));
    if (panel.state == "closed") {
      panel.openPopupAtScreen(event.screenX + 10, event.screenY + 10, false);
    }
    else {
      panel.moveTo(event.screenX + 10, event.screenY + 10);
    }
  },

  setPreviewImage: function SE_setPreviewImage(url, isImage) {
    let image = document.getElementById("USMPreviewPanelImage");
    let panel = document.getElementById("USMPreviewPanel");
    panel.removeAttribute("style");
    image.removeAttribute("style");
    panel.setAttribute("class", "checkerboard");
    image.setAttribute("style", "background-color:" + url);
  },

  onMouseClick: function SE_onMouseClick(event) {
    if (event.button == 2) {
      return;
    }
    if (this.$("USMPreviewPanel").state == "open") {
      this.$("USMPreviewPanel").hidePopup();
    }
    let offset = this.getOffsetAtLocation(event.pageX, event.pageY);
    this.caretPosCol= this.editor.getCursor().ch;
    this.caretPosLine = this.editor.getCursor().line;
    let panel = document.getElementById("USMColorPickerPanel");
    let text = this.getText();
    let rgbhslaMatch = false, color;
    let match = text.slice(0, offset).match(/(r|rg|rgb|rgba|h|hs|hsl|hsla)[ ,0-9%.\)\(]{0,}$/);
    if (!match) {
      match = text.slice(0, offset).match(/(#)[0-9abcdef]{0,6}$/i);
    }
    if (!match) {
      panel.hidePopup();
      return;
    }
    let startIndex = offset - match[0].length;
    match = text.slice(startIndex).match(new RegExp(RGB_HSLA_MATCH, 'i'));
    if (!match) {
      match = text.slice(startIndex).match(new RegExp(HEX_MATCH, 'i'));
    }
    else {
      rgbhslaMatch = true;
    }
    if (!match) {
      return;
    }
    // Updating startIndex to be accurate
    startIndex += rgbhslaMatch
                    ? text.slice(startIndex).search(new RegExp(RGB_HSLA_MATCH, 'i'))
                    : text.slice(startIndex).search(new RegExp(HEX_MATCH, 'i'));
    let screen = this.getLocationAtOffset(startIndex);
    if ((screen.x - event.pageX) > 20 ||
        (screen.x - event.pageX) < -10*(match[0].length + (rgbhslaMatch?0:6)) ||
        (screen.y - event.pageY) > 25 ||
        (screen.y - event.pageY) < -15) {
      return;
    }

    if (rgbhslaMatch && match[2]) {
      let len = match[2].split(",").length;
      if (len == 3 || len == 4) {
        color = match[2].replace(/[ ]{0,}/g, "").split(",");
        if (color.length == 4) {
          color.pop();
        }
      }
      else {
        return;
      }
    }
    else if (!rgbhslaMatch && match[2]) {
      color = match[2];
      if (color.length%3 != 0) {
        return;
      }
    }
    else {
      return;
    }
    this.colorCaretOffset = startIndex;
    this.colorMatch = rgbhslaMatch? RGB_HSLA_MATCH: HEX_MATCH;
    this.color = color;
    //colorPicker(e,mode,size,rO/*readOnly*/,offsetX,offsetY,orientation
    //,parentObj,parentXY,color,difPad,rSpeed,docBody,onColorSave,onColorChange)
    if (match[1].search('hsl') > -1) {
      // only rgb and hex values for now
      return;
    }
    colorPicker(event, 'B', 3, false, null, null, null, panel, null,
                match[1].search('hsl') > -1? this.HSV2RGB(color): color,
                null, null, panel, this.onColorPickerSave.bind(this));
    if (panel.state == "open") {
      panel.moveTo(event.screenX, event.screenY + 15);
    }
    else {
      panel.openPopupAtScreen(event.screenX, event.screenY + 15, false);
    }
    listen(window, panel, "popuphidden", function() {
      this.colorCaretOffset = -1;
      this.colorMatch = '';
      this.color = [];
      this.editor.focus();
    }.bind(this));
  },

  HSV2RGB: function SE_HSV2RGB([x,y,z]) {
    x = x.replace("%",""); y = y.replace("%",""); z = z.replace("%","");
    var r=0, g=0, b=0, c=0, d=(100-y/2.55)/100, i=z/255,j=z*(255-y)/255;

    if (x<42.5){r=z;g=x*6*i;g+=(z-g)*d;b=j}
    else if (x>=42.5&&x< 85){c=42.5;r=(255-(x-c)*6)*i;r+=(z-r)*d;g=z;b=j}
    else if (x>=85&&x<127.5){c=85;r=j;g=z;b=(x-c)*6*i;b+=(z-b)*d}
    else if (x>=127.5&&x<170){c=127.5;r=j;g=(255-(x-c)*6)*i;g+=(z-g)*d;b=z}
    else if (x>=170&&x<212.5){c=170;r=(x-c)*6*i;r+=(z-r)*d;g=j;b=z}
    else if (x>=212.5){c=212.5;r=z;g=j;b=(255-(x-c)*6)*i;b+=(z-b)*d}
    return [Math.round(r),Math.round(g),Math.round(b)];
  },

  onColorPickerSave: function SE_onColorPickerSave(rgb, hsv, hex) {
    if (this.colorCaretOffset == -1 ||
        this.colorMatch == '' ||
        this.color == []) {
      return;
    }
    let text = this.getText().slice(this.colorCaretOffset);
    let match = text.match(new RegExp(this.colorMatch, 'i'));
    let color = this.regexp2RGB(match, rgb, hsv, hex);
    if (color.match(new RegExp(this.colorMatch, 'i'))[2] == match[2]) {
      return;
    }
    this.setText(color, this.colorCaretOffset, this.colorCaretOffset + match[0].length);
  },

  regexp2RGB: function SE_regexp2RGB(match, rgb, hsv, hex) {
    let color = match[2].split(",");
    rgb = match[1].search(/rgba?/i) > -1? rgb: match[1].search(/hsla?/i) > -1? hsv: null;
    if (!rgb) {
      color = hex;
    }
    else {
      for (let i = 0; i < 3; i++) {
        color[i] = color[i].replace(/[0-9.]+/,Math.round(rgb[i]));
      }
      color = color.join(",");
    }

    return match[1] + (match[1] != '#'? '(': '') + color +
           (match[1] != '#'? ')': '');
  },

  getAffectedContent: function SE_getAffectedContent() {
    let text = this.getText();
    let matchedURL = text.match(/[@]-moz-document[ ]+(((url|url-prefix|domain)[ ]{0,}\([\'\"]{0,1}([^\'\"\)]+)[\'\"]{0,1}\)[ ,]{0,})+)/);
    if (!matchedURL) {
      return "chrome://";
    }
    let urlList = matchedURL[1].replace(/[ ]{0,}(url|url-prefix|domain)\(['"]?/g, "")
                               .replace(/['"]?\)[ ]{0,}/g, "")
                               .split(",");
    if (!urlList) {
      return "";
    }
    return urlList.join(",");
  },

  saveButtonClick: function(aEvent, aCallback) {
    if (!this.validateCSS()) {
      return;
    }
    if (this.saved && styleSheetList[this.index][1] ==
          escape(this.doc.getElementById("USMFileNameBox").value)) {
      return;
    }
    if (this.previewShown) {
      unloadStyleSheet(this.index);
      this.previewShown = false;
      styleSheetList[this.index][0] = this.origEnabled;
      styleSheetList[this.index][2] = this.origPath;
    }
    if (this.getText() == "") {
      return;
    }
    if (!this.createNew && !this.openNew) {
      styleSheetList[this.index][8] = true;
      unloadStyleSheet(this.index);
    }
    if (this.options) {
      styleSheetList[this.index][7] = this.options;
    }
    let changes = false;
    if (this.createNew) {
      if (this.styleName.length == 0) {
        styleSheetList[this.index][1] = escape(this.doc.getElementById("USMFileNameBox").value);
      }
      let fileName = this.doc.getElementById("USMFileNameBox").value.replace(/[\\\/:*?\"<>|]+/gi, "")
      styleSheetList[this.index][2] = escape(fileName + ".css");
      if (unescape(styleSheetList[this.index][2]) == ".css") {
        styleSheetList[this.index][2] = escape("User Created Style Sheet " + this.index + ".css");
      }
      this.styleSheetFile = getFileURI(unescape(styleSheetList[this.index][2]))
                              .QueryInterface(Ci.nsIFileURL).file;
      if (!this.styleSheetFile.exists()) {
        try {
          this.styleSheetFile.create(0, parseInt('0666', 8));
        } catch (ex) { return; }
      }
      // File with sam name exists, so renaming it to original name (1) format
      else {
        let i = 1;
        while (this.styleSheetFile.exists()) {
          styleSheetList[this.index][2] = escape(unescape(styleSheetList[this.index][2])
                                            .replace(/[^\\\/]{0,}\.css$/,
                                                     fileName + " (" + i++ + ").css"));
          this.styleSheetFile = getFileURI(unescape(styleSheetList[this.index][2]))
                                  .QueryInterface(Ci.nsIFileURL).file;
        }
        this.styleSheetFile.create(0, parseInt('0666', 8));
      }
    }
    else {
      let fileName = this.doc.getElementById("USMFileNameBox").value.replace(/[\\\/:*?\"<>|]+/gi, "");
      if (unescape(styleSheetList[this.index][2]).match(/[\\\/]?([^\\\/]{0,})\.css$/)[1] != fileName) {
        changes = true;
        this.styleSheetFile = getFileURI(unescape(styleSheetList[this.index][2]))
                                .QueryInterface(Ci.nsIFileURL).file;
        if (this.styleSheetFile.exists()) {
          try {
            this.styleSheetFile.remove(false);
          } catch (ex) {}
        }
        styleSheetList[this.index][2] = escape(unescape(
          styleSheetList[this.index][2]).replace(/[^\\\/]{0,}\.css$/, fileName + ".css"));
        this.styleSheetFile = getFileURI(unescape(styleSheetList[this.index][2]))
                                .QueryInterface(Ci.nsIFileURL).file;
        if (!this.styleSheetFile.exists()) {
          try {
            this.styleSheetFile.create(0, parseInt('0666', 8));
          } catch (ex) { return; }
        }
        // File with sam name exists, so renaming it to original name (1) format
        else {
          let i = 1;
          while (this.styleSheetFile.exists()) {
            styleSheetList[this.index][2] = escape(unescape(styleSheetList[this.index][2])
                                              .replace(/[^\\\/]{0,}\.css$/,
                                                       fileName + " (" + i++ + ").css"));
            this.styleSheetFile = getFileURI(unescape(styleSheetList[this.index][2]))
                                    .QueryInterface(Ci.nsIFileURL).file;
          }
          this.styleSheetFile.create(0, parseInt('0666', 8));
        }
      }
    }
    let ostream = FileUtils.openSafeFileOutputStream(this.styleSheetFile);
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                      .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    let text = this.fixupText();
    let istream = converter.convertToInputStream(text);
    NetUtil.asyncCopy(istream, ostream, function(status) {
      if (!Components.isSuccessCode(status)) {
        this.win.alert(this.STR("error.fileSaving"));
        return;
      }
      // Getting the affected content of the stylesheet
      styleSheetList[this.index][4] = this.getAffectedContent();
      styleSheetList[this.index][6] = JSON.stringify(new Date());
      loadStyleSheet(this.index);
      writeJSONPref(function() {
        // Update the mapped code and push for syncing
        if (mappedCodeForIndex[this.index] != text) {
          mappedCodeForIndex[this.index] = text;
          changes = true;
        }
        if (changes) {
          Services.obs.notifyObservers(null, "USM:codeMappings:updated",
                                       JSON.stringify(this.index));
        }
      }.bind(this));
      this.onTextSaved();
      if (aCallback) {
        aCallback();
      }
      else if (this.openNew ||
               (this.createNew && styleSheetList[this.index][3].length > 10)) {
        // Close the editor on save if add a new file
        this.exitButtonClick(aEvent);
      }
    }.bind(this));
  },

  exitButtonClick: function(aEvent) {
    let caretOffset = this.getCaretOffset();
    let toClose = this.promptSave();
    // Cancel
    if (toClose == 1) {
      aEvent.preventDefault();
      this.setCaretOffset(caretOffset);
      return;
    }
    // Save and exit
    else if (toClose == 0) {
      this.saveButtonClick(null, function() {
        this.callback && this.callback();
        this.win.close();
      }.bind(this));
      return;
    }
    // Don't Save
    else {
      if (this.previewShown) {
        unloadStyleSheet(this.index);
        this.previewShown = false;
        styleSheetList[this.index][0] = this.origEnabled;
        styleSheetList[this.index][2] = this.origPath;
        if (!this.createNew && !this.openNew) {
          loadStyleSheet(this.index);
        }
      }
      if ((this.createNew || this.openNew) && !this.savedOnce) {
        styleSheetList.splice(this.index, 1);
      }
    }
    this.resetVariables();
    this.callback && this.callback();
    this.win.close();
  },

  previewButtonClick: function () {
    if (!this.validateCSS(true)) {
      return;
    }
    let tmpFile = getURIForFileInUserStyles("tmpFile.css")
                    .QueryInterface(Ci.nsIFileURL).file;
    if (!tmpFile.exists()) {
      tmpFile.create(0, parseInt('0666', 8));
    }
    let ostream = FileUtils.openSafeFileOutputStream(tmpFile);
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                      .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    let istream = converter.convertToInputStream(this.fixupText());
    NetUtil.asyncCopy(istream, ostream, function(status) {
      if (!Components.isSuccessCode(status)) {
        return;
      }
      // Unload the previous preview if there
      if (this.previewShown || (!this.createNew && !this.openNew)) {
        unloadStyleSheet(this.index);
      }
      this.previewShown = true;
      styleSheetList[this.index][0] = 'enabled';
      styleSheetList[this.index][2] = escape("tmpFile.css");
      loadStyleSheet(this.index);
    }.bind(this));
  },

  /** Pass various options in the following format
   ** as the fourth argument while opening editor
   ** [
   **   openNew, // bool , true if opening a new file
   **   index, // in case of editing an existing file, use this
   **   createNew, // bool , true if creating a new file.CANNOT be true if above true
   **   path, // string containing the path of the new file to open when openNew true
   **         // or when createNew, the initialText to be displayed in the editor window
   **   callback, // bool to tell whther to callback to open options window or not
   **   styleName, // New in version 0.9, name of style
   **   updateURL, // New in version 0.9 , the update url of the style
   **   options  // Options of the style sheet associated with its userstyles page
   ** ]
   **/
  onLoad: function SE_onLoad(aEvent) {

    let startEditor = (text = "") => {
      this.editor.setText(text);
      this.editor.clearHistory();
      this.origPath = styleSheetList[this.index][2];
      this.origEnabled = styleSheetList[this.index][0];
      this.styleName = styleSheetList[this.index][1];
      this.onEditorLoad();
    };

    let readFileData = () => {
      if (mappedCodeForIndex[this.index] &&
          mappedCodeForIndex[this.index].length > 0) {
        let data = "";
        try {
          data = mappedCodeForIndex[this.index];
        } catch (ex) {}
        startEditor(data);
      }
      else {
        let decoder = new TextDecoder();
        let promise = OS.File.read(this.styleSheetFile.path);
        promise = promise.then(
          function onSuccess(data) {
            data = decoder.decode(data);
            return startEditor(data);
          },
          function onFailure(reason) {
            this.resetVariables();
            this.win.close();
            return;
          }
        );
      }
    };

    if (aEvent.target != this.doc) {
      return;
    }
    // Check if the window was opened with any arguments called
    if (this.win.arguments[0]) {
      let args = this.win.arguments[0];
      if (args instanceof Ci.nsIDialogParamBlock) {
        args = JSON.parse(args.GetString(0));
      }
      if (args[0]) {
        // open a new file
        this.openNew = true;
        this.styleName = escape(args[3].split(/[\/\\]/g).slice(-1)[0].replace(".css", ""));
        this.stylePath = "file:///" + unescape(args[3]).replace(/[\\]/g, "/");
      }
      else if (args[2]) {
        this.createNew = true;
        if (args[3].length > 0) {
          this.initialText = args[3];
        }
      }
      else {
        this.index = args[1];
      }
      if (args[4]) {
        this.callback = function() {
          if (pref("hideOptionsWhileEditing")) {
            Services.wm.getMostRecentWindow("navigator:browser")
                    .openDialog("chrome://userstylemanager/content/options.xul",
                                "User Style Manager Options", "chrome,resizable,centerscreen");
          }
        };
      }
      if (args[5] && this.styleName.length == 0) {
        this.styleName = escape(args[5]);
      }
      if (args[6]) {
        this.updateURL = args[6];
      }
      if (args[7]) {
        this.options = args[7];
      }
    }


    // Checking if clear default namespace needs to be disabled
    this.doc.getElementById("se-cmd-clearDefaultNamespace")
        .setAttribute("disabled", pref("defaultNamespace").match(/(xhtml|xul|none)/) == null);

    if (this.initialText.length == 0) {
      this.initialText = this.STR("placeholder.text");
    }
    let keyMap = {
      "Tab": this.inputHelper.bind(this, "tab"), // This does not work for now
      "Down": this.inputHelper.bind(this, "down"),
      "Up": this.inputHelper.bind(this, "up"),
      "Enter": this.inputHelper.bind(this, "enter"),
      "Delete": this.inputHelper.bind(this, "other"),
      "Backspace": this.inputHelper.bind(this, "other"),
      "Left": this.inputHelper.bind(this, "other"),
      "Right": this.inputHelper.bind(this, "other"),
      "Home": this.inputHelper.bind(this, "other"),
      "End": this.inputHelper.bind(this, "other"),
    };
    let config = {
      value: this.initialText,
      lineNumbers: true,
      mode: Editor.modes.css,
      readOnly: false,
      autoCloseBrackets: "{}()[]''\"\"",
      contextMenu: "USMStyleEditorContextMenu",
      extraKeys: keyMap
    };
    this.editor = new Editor(config);debugger;
    let editorPlaceholder = this.doc.getElementById("USMTextEditor");
    this.previewShown = false;
    this.saved = !this.createNew && !this.openNew;

    this.editor.appendTo(editorPlaceholder).then(() => {
      // Hack for Tab key to work.
      this.editor.extend({
        overrideTab: ({cm}) => {
          cm.addKeyMap({
            "Tab": this.inputHelper.bind(this, "tab")
          });
        }
      });
      this.editor.overrideTab();
      readJSONPref(() => {
        if (this.createNew) {
          this.index = styleSheetList.length;
          styleSheetList.push([
            'enabled', "",
            (this.styleName.length > 0
             ? this.styleName + ".css"
             : escape("User Created Style Sheet " + this.index + ".css")),
            this.updateURL, "", JSON.stringify(new Date()), ""
          ]);
        }
        else if (this.openNew) {
          this.index = styleSheetList.length;
          styleSheetList.push(['enabled', this.styleName, escape(this.stylePath),
                               "", "", JSON.stringify(new Date()), ""]);
        }

        if (this.createNew) {
          try {
            startEditor();
          }
          catch (ex) {
            this.styleSheetList.splice(this.index, 1);
            this.resetVariables();
            this.win.close();
          }
        }
        // Read the file and put the content in textBox
        else {
          let fileURI = getFileURI(unescape(styleSheetList[this.index][2]));
          this.styleSheetFile = fileURI.QueryInterface(Ci.nsIFileURL).file;
          if (!this.styleSheetFile.exists()) {
            doRestore(this.index, readFileData);
          }
          else {
            readFileData();
          }
        }
      });
    });
  },

  onEditorLoad: function SE_onEditorLoad() {
    this.editor.focus();
    this.initialized = true;
    this.editor.container.addEventListener("keyup", this.postInputHelper, true);
    this.editor.container.addEventListener("keydown", this.preInputHelper, true);

    if (!this.createNew) {
      if (this.styleName && !this.saved) {
        this.onTextChanged();
      }
      else if (this.styleName && this.saved) {
        this.onTextSaved();
      }
    }
    else {
      this.onTextChanged();
      this.setCaretOffset(this.getText().length);
    }
    if (this.createNew) {
      this.setTitle(this.STR("newStyleSheet") + " - " + this.STR("USM.label"));
    }
    else {
      this.setTitle(unescape(this.styleName) + " - " + this.STR("USM.label"));
    }
    if (!this.createNew) {
      this.$("USMFileNameLabel").setAttribute("collapsed", true);
      this.$("USMFileNameEditingLabel").setAttribute("collapsed", false);
    }
    this.$("USMFileNameBox").value =
      unescape(styleSheetList[this.index][2].match(/[\\\/]?([^\\\/]{0,})\.css$/)[1]);
    this.$("USMButtonSave").onclick = this.saveButtonClick;
    if (this.openNew || this.createNew) {
      this.$("USMButtonSave").label = this.STR("addLabel");
    }
    this.$("USMButtonPreview").onclick = this.previewButtonClick;
    this.$("USMButtonExit").onclick = this.exitButtonClick;
    // Assigning the mouse move and mouse click handler
    this.editor.container.addEventListener("mousemove", this.onMouseMove);
    this.editor.container.addEventListener("click", this.onMouseClick, true);
    this.editor.container.addEventListener("dblclick", this.onDblClick, true);
    if (this.getText() == this.STR("placeholder.text")) {
      this.selectRange(0, this.getText().length);
    }
    else {
      this.setCaretOffset(0);
    }

    // Check for the codeBlockStyle to be empty and prompt the user to
    // choose one style or enter his own
    if (this.codeBlockStyle == {}) {
      this.promptCodeBlockStyles();
    }
  },

  getCaretOffset: function SE_getCaretOffset() {
    return this.editor.getOffset(this.editor.getCursor());
  },

  setCaretOffset: function SE_setCaretOffset(aOffset) {
    this.editor.setCursor(this.editor.getPosition(aOffset));
  },

  onToolsMenuShowing: function SE_onToolsMenuShowing() {
    let addNamespace = this.doc.getElementById("se-cmd-addNamespace");
    addNamespace.setAttribute("disabled", this.getText()
      .search(/[@]namespace[ ]+url\(['"]?http:\/\/www.mozilla.org\/keymaster\/gatekeeper\/there\.is\.only\.xul['"]?\);/) >= 0);
    let addWebNamespace = this.doc.getElementById("se-cmd-addWebNamespace");
    addWebNamespace.setAttribute("disabled", this.getText()
      .search(/[@]namespace[ ]+url\(['"]?http:\/\/www\.w3\.org\/1999\/xhtml['"]?\);/) >= 0);
    this.doc.getElementById("se-cmd-clearDefaultNamespace")
        .setAttribute("disabled", pref("defaultNamespace").match(/(xhtml|xul|none)/) == null);
  },

  onToolsMenuHiding: function SE_onToolsMenuHiding() {
    this.doc.getElementById("se-cmd-addNamespace").setAttribute("disabled", false);
    this.doc.getElementById("se-cmd-addWebNamespace").setAttribute("disabled", false);
  },

  find: function SE_find(aString, aOptions) {
    aOptions = aOptions || {};
    let text = this.getText();
    if (!this.$("se-search-regexp").checked) {
      let str = aOptions.ignoreCase ? aString.toLowerCase() : aString;

      if (aOptions.ignoreCase) {
        text = text.toLowerCase();
      }

      return (aOptions.backwards
              ? text.lastIndexOf(str, aOptions.start)
              : text.indexOf(str, aOptions.start));
    }
    else {
      if (this.regexpIndex == -1) {
        return [-1, null];
      }
      let modifiers = "gm";
      if (aOptions.ignoreCase) {
        modifiers += "i";
      }
      let r;
      try {
        r = new RegExp(aString, modifiers);
      } catch (ex) {
        return [-1, null];
      }
      // Hack to set the regexpindex to last possible value
      if (this.regexpIndex == -2) {
        this.regexpIndex = text.split(r).length - 1;
      }
      this.regexpIndex += (aOptions.backwards? -1: 1);
      if (this.regexpIndex <= 0) {
        return [-1, null];
      }
      for (let i = 1; i < this.regexpIndex; i++) {
        r.exec(text);
      }
      let result = r.exec(text);
      result = result?result[0]:null;
      if (!result) {
        return [-1, null];
      }
      let index = r.lastIndex - result.length;
      return [index, result];
    }
  },

  handleRestOfFind: function SE_handleRestOfFind(searchText, searchOptions) {
    let index, resultText;
    let searchIndex = 0, count = 0;
    if (this.$("se-search-regexp").checked) {
      [index, resultText] = this.find(searchText, searchOptions);
    }
    else {
      index = this.find(searchText, searchOptions);
    }
    if (this.$("se-search-wrap").checked && index < 0) {
      searchOptions.start = searchOptions.backwards? this.getText().length: 0;
      this.regexpIndex = searchOptions.backwards? -2: 0;
      if (this.$("se-search-regexp").checked) {
        [index, resultText] = this.find(searchText, searchOptions);
      }
      else {
        index = this.find(searchText, searchOptions);
      }
    }
    if (this.$("se-search-regexp").checked) {
      try {
        count = this.getText()
                    .split(new RegExp(searchText,"gm" + (searchOptions.ignoreCase? "i": "")))
                    .length - 1;
      } catch (ex) {
        count = 0;
      }
    }
    else {
      let txt = searchOptions.ignoreCase? this.getText().toLowerCase(): this.getText();
      searchText = searchOptions.ignoreCase? searchText.toLowerCase(): searchText
      count = txt.split(searchText).length - 1;
    }
    // don't update searchindex if we think that it is because
    // of trying to wrap on no wrap
    if (index < 0 && count <= 0) {
      this.regexpIndex = -1;
    }
    else if (index >= 0) {
      if (this.$("se-search-regexp").checked) {
        searchIndex = this.regexpIndex - 1;
        this.selectRange(index, index + resultText.length);
      }
      else {
        this.selectRange(index, index + searchText.length);
        let txt = searchOptions.ignoreCase? this.getText().toLowerCase(): this.getText();
        searchIndex = txt.slice(0, index).split(searchText).length - 1;
      }
    }
    else {
      searchIndex = searchOptions.backwards? 0: count - 1;
      this.regexpIndex = searchOptions.backwards? 1: count;
    }
    this.$("se-search-index").value = searchIndex + (count > 0? 1: 0);
    this.$("se-search-count").value = count;
    this.$("se-search-count").style.color = count? "green": "red";
    this.$("se-search-box").focus();
    if (this.$("se-search-regexp").checked) {
      return [index, resultText];
    }
    else {
      return [index]
    }
  },

  doNewFind: function SE_doNewFind() {
    let selected = this.selectedText();
    if (selected && selected.length > 0) {
      this.$("se-search-box").value = selected;
    }
    this.doFind();
  },

  doFind: function SE_doFind() {
    let searchText = this.$("se-search-box").value;
    if (!this.$("se-search-box").focused && searchText.length == 0) {
      this.$("se-search-box").focus();
      this.$("se-search-index").value = " 0";
      this.$("se-search-count").value = " 0";
      this.$("se-search-count").style.color = "rgb(50,50,50)";
    }
    else if (searchText.length > 0) {
      let searchOptions = [];
      if (searchText == this.lastFind) {
        searchOptions = {
          backwards: this.$("se-search-backwards").checked,
          ignoreCase: this.$("se-search-case").checked,
          start: this.getCaretOffset(),
        };
      }
      else {
        this.lastFind = searchText;
        searchOptions = {
          backwards: this.$("se-search-backwards").checked,
          ignoreCase: this.$("se-search-case").checked,
          start: this.getCaretOffset() - searchText.length - 1,
        };
      }
      return this.handleRestOfFind(searchText, searchOptions);
    }
    return [-1, null];
  },

  doFindPrevious: function SE_doFindPrevious() {
    let searchText = this.$("se-search-box").value;
    if (!this.$("se-search-box").focused && searchText.length == 0) {
      this.$("se-search-box").focus();
      this.$("se-search-index").value = " 0";
      this.$("se-search-count").value = " 0";
      this.$("se-search-count").style.color = "rgb(50,50,50)";
    }
    else if (searchText.length > 0) {
      let searchOptions = {};
      if (searchText == this.lastFind) {
        searchOptions = {
          backwards: !this.$("se-search-backwards").checked,
          ignoreCase: this.$("se-search-case").checked,
          start: this.getCaretOffset() - searchText.length - 1,
        };
      }
      else {
        this.lastFind = searchText;
        searchOptions = {
          backwards: !this.$("se-search-backwards").checked,
          ignoreCase: this.$("se-search-case").checked,
          start: this.getCaretOffset(),
        };
      }
      this.handleRestOfFind(searchText, searchOptions);
    }
  },

  doReplace: function SE_doReplace(replaceAll) {
    if (!this.replaceVisible) {
      if (this.$("se-search-options-panel").state == "open") {
        this.$("se-search-options-panel").hidePopup();
      }
      this.$("se-replace-container").style.opacity = 1;
      this.$("se-replace-container").style.maxHeight = "30px";
      this.$("se-replace-container").style.margin = "0px";
      this.replaceVisible = true;
    }
    let replaceText = this.$("se-replace-box").value;
    let searchText = this.$("se-search-box").value;
    if (replaceText.length > 0 && searchText.length > 0) {
      let count = this.$("se-search-count").value.replace(/[ ]+/g, "")*1;
      let searchIndex = this.$("se-search-index").value.replace(/[ ]+/g, "")*1;
      if (count > 0 && searchIndex <= count) {
        let caretOffset = this.getCaretOffset();
        if (replaceAll) {
          let text = this.getText();
          let modifiers = "gm";
          if (this.$("se-search-case").checked) {
            modifiers += "i";
          }
          text = text.replace(new RegExp(searchText, modifiers), replaceText);
          this.setText(text);
          this.selectRange(caretOffset - searchText.length, caretOffset - searchText.length + replaceText.length);
        }
        else {
          if (this.lastReplacedIndex != caretOffset - this.selectedText().length) {
            this.setCaretOffset(caretOffset - this.selectedText().length);
          }
          let index;
          if (this.$("se-search-regexp").checked) {
            this.regexpIndex = searchIndex - 1;
            [index, searchText] = this.doFind();
          }
          else {
            [index] = this.doFind();
          }
          this.lastReplacedIndex = index;
          if (index >= 0) {
            this.setText(replaceText, index, index + searchText.length);
            this.setCaretOffset(index + replaceText.length);
            this.doFind();
          }
        }
      }
    }
    this.$("se-replace-box").focus();
  },

  onReplaceFocus: function SE_onReplaceFocus() {
    let searchText = this.$("se-search-box").value;
    this.$("se-replace-toolbar").style.opacity = 1;
    this.$("se-replace-toolbar").style.maxWidth = "200px";
    this.onSearchFocus();
  },

  onReplaceBlur: function SE_onReplaceBlur() {
    if (this.$("se-replace-box").value.length > 0 &&
        this.$("se-search-box").value.length > 0) {
      return;
    }
    this.$("se-replace-toolbar").style.opacity = 0;
    this.$("se-replace-toolbar").style.maxWidth = "0px";
    this.onSearchBlur();
  },

  closeReplace: function SE_closeReplace() {
    if (this.replaceVisible) {
      this.$("se-replace-container").style.opacity = 0;
      this.$("se-replace-container").style.maxHeight = "0px";
      this.$("se-replace-container").style.margin = "-70px 0px 44px 0px";
      this.replaceVisible = false;
    }
    this.onSearchBlur();
  },

  onSearchFocus: function SE_onSearchFocus() {
    this.$("se-search-toolbar").style.opacity = 1;
    this.$("se-search-toolbar").style.maxWidth = "200px";
    this.searchVisible = true;
  },

  onSearchBlur: function SE_onSearchBlur() {
    if (this.$("se-search-options-panel").state == "open" ||
        this.$("se-search-options-panel").state == "showing") {
      return;
    }
    this.$("se-search-toolbar").style.opacity = 0;
    this.$("se-search-toolbar").style.maxWidth = "0px";
    this.searchVisible = false;
  },

  searchPanelHidden: function DE_searchPanelHidden() {
    if (this.$("se-search-box").value.length > 0) {
      this.onSearchFocus();
      this.$("se-search-box").focus();
    }
    else {
      this.onSearchBlur();
      this.editor.focus();
    }
  },

  addNamespace: function SE_addNameSpace() {
    if (this.getText().search(/[@]namespace[ ]+url\(['"]?http:\/\/www.mozilla.org\/keymaster\/gatekeeper\/there\.is\.only\.xul['"]?\)/) >= 0) {
      return;
    }
    if (this.createNew && this.getText().match(/^(\/\*[^*\/]{0,}\*\/\n)$/)) {
      this.setText("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n");
    }
    else {
      this.setText("@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n" + this.getText());
    }
    this.setCaretOffset(79);
  },

  addWebNamespace: function SE_addWebNameSpace() {
    if (this.getText().search(/[@]namespace[ ]+url\(['"]?http:\/\/www.w3.org\/1999\/xhtml['"]?\)/) >= 0) {
      return;
    }
    if (this.createNew && this.getText().match(/^(\/\*[^*\/]{0,}\*\/\n)$/)) {
      this.setText("@namespace url(http://www.w3.org/1999/xhtml);\n");
    }
    else {
      this.setText("@namespace url(http://www.w3.org/1999/xhtml);\n" +
                   this.getText());
    }
    this.setCaretOffset(46);
  },

  addMozURL: function SE_addMozURL() {
    let pos = this.getCaretOffset();
    let [start, end] = this.getSelectionPoints();
    if (start == end) {
      this.setText("@-moz-document url('') {\n}", pos, pos);
    }
    else {
      this.setText("@-moz-document url('') {\n" + this.selectedText() + "\n}",
                   start, end);
    }
    this.setCaretOffset(pos + 20);
  },

  addMozPreURL: function SE_addMozPreURL() {
    let pos = this.getCaretOffset();
    let [start, end] = this.getSelectionPoints();
    if (start == end) {
      this.setText("@-moz-document url-prefix('') {\n}", pos, pos);
    }
    else {
      this.setText("@-moz-document url-prefix('') {\n" + this.selectedText() + "\n}",
                   start, end);
    }
    this.setCaretOffset(pos + 27);
  },

  addMozDomain: function SE_addMozDomain() {
    let pos = this.getCaretOffset();
    let [start, end] = this.getSelectionPoints();
    if (start == end) {
      this.setText("@-moz-document domain('') {\n}", pos, pos);
    }
    else {
      this.setText("@-moz-document domain('') {\n" + this.getText(start, end) + "\n}", start, end);
    }
    this.setCaretOffset(pos + 23);
  },

  clearDefaultNamespace: function SE_clearDefaultNamespace() {
    pref("defaultNamespace", "");
  },

  closeErrorPanel: function SE_closeErrorPanel() {
    let errorPanel = this.$("USMErrorPanel");
    this.$("USMErrorLabel").style.opacity = 0;
    this.$("USMErrorLabel").style.margin = "30px 0px -60px 0px";
    errorPanel.style.opacity = 0;
    errorPanel.style.margin = "100px 0px -100px 0px;";
    while (errorPanel.firstChild) {
      errorPanel.removeChild(errorPanel.firstChild);
    }
  },

  validateCSS: function SE_validateCSS(previewing) {
    {
      let errorPanel = this.$("USMErrorPanel");
      while (errorPanel.firstChild) {
        errorPanel.removeChild(errorPanel.firstChild);
      }
    }
    function getLine(i) {
      return numLines;
    }

    let createErrorLine = function(aLineNum, aMsg, aOffset) {
      let line = document.createElementNS(XUL, "hbox");
      line.setAttribute("class", "error-panel-line");
      line.onclick = function() {
        this.setCaretOffset(aOffset);
        this.editor.focus();
      }.bind(this);
      let lineNum = document.createElementNS(XUL, "label");
      lineNum.setAttribute("value", "Line " + (aLineNum + 1) + ":");
      lineNum.setAttribute("class", "error-panel-line-num");
      lineNum.setAttribute("flex", "0");
      let msg = document.createElementNS(XUL, "label");
      msg.setAttribute("value", aMsg);
      msg.setAttribute("class", "error-panel-msg");
      msg.setAttribute("flex", "1");
      line.appendChild(lineNum);
      line.appendChild(msg);
      return line;
    }.bind(this);

    // This is a syntax validator as of now.
    let text = this.getText();
    let origCaretPos = this.getCaretOffset();
    let error = false;
    let errorList = [];
    let warningList = [];
    let bracketStack = [];
    let bracketStackLine = [];
    let bracketStackOffset = [];
    let numLines = 0;
    if (previewing == null) {
      previewing = false;
    }
    // comments in this bracketStack are represented by #

    bracketStack.__defineGetter__("last", function() {
      if (bracketStack.length == 0) {
        return "";
      }
      return bracketStack[bracketStack.length - 1];
    });

    function add(x, i) {
      bracketStackOffset.push(i);
      bracketStackLine.push(getLine(i));
      bracketStack.push(x);
    };

    function del() {
      bracketStackOffset.pop();
      bracketStackLine.pop();
      bracketStack.pop();
    };

    for (let i = 0; i < text.length; i++) {
      switch (text[i]) {
        case '\n':
          numLines++;
          while (bracketStack.last == '"' || bracketStack.last == "'") {
            del();
          }
          break;

        case '/':
          if (bracketStack.last == '"' || bracketStack.last == "'") {
            break;
          }
          // this can probably mean a comment start or end
          if (bracketStack.last == '*') {
            // comment end
            del();
            // checking if this comment was even started
            if (bracketStack.last != '#') {
              errorList.push([getLine(i), i, this.STR("error.comment")]);
            }
            else {
              del();
            }
          }
          else if (bracketStack.last != '/') {
            add('/', i);
          }
          break;

        case '*':
          if (bracketStack.last == '"' || bracketStack.last == "'") {
            break;
          }
          // this can probably mean a comment start or end
          if (bracketStack.last == '/') {
            // comment start
            del();
            // checking if any comment was started before also
            if (bracketStack.last != '#') {
              add('#', i);
            }
          }
          else if (bracketStack.last != '*') {
            add('*', i);
          }
          break;

        case "'":
          if (bracketStack.last == '#') {
            break;
          }
          if (bracketStack.last == "'") {
            del();
          }
          else if (bracketStack.last == '"') {
            break;
          }
          else {
            add("'", i);
          }
          break;

        case '"':
          if (bracketStack.last == '#') {
            break;
          }
          if (bracketStack.last == '"') {
            del();
          }
          else if (bracketStack.last == "'") {
            break;
          }
          else {
            add('"', i);
          }
          break;

        case '{':
          if (bracketStack.last == '"' ||
              bracketStack.last == "'" ||
              bracketStack.last == '#') {
            break;
          }
          else if (bracketStack.last == '/' || bracketStack.last == '*') {
            del();
          }
          if (bracketStack.last == ':') {
            errorList.push([getLine(i), i, this.STR("error.missing") + " ;"]);
            del();
          }
          if (text.slice(0, i + 1)
                  .match(/[@]-moz-document[ ]+(url(-prefix)?|domain|regexp)[^\{\}]+\{$/)) {
            add('{{', i);
          }
          else {
            add('{', i);
          }
          break;

        case '}':
          if (bracketStack.last == '"' ||
              bracketStack.last == "'" ||
              bracketStack.last == '#') {
            break;
          }
          else if (bracketStack.last == '/' || bracketStack.last == '*') {
            del();
          }
          if (bracketStack.last == ':') {
            del();
          }
          if (bracketStack.last == '{') {
            add('}', i);
          }
          else if (bracketStack.last == '{{') {
            del();
          }
          else if (bracketStack.last == '}') {
            while (bracketStack.last == '}' &&
                   (bracketStack[bracketStack.length - 2] == '{' ||
                    bracketStack[bracketStack.length - 2] == '{{')) {
              del();
              del();
            }
            if (bracketStack.last == '{' || bracketStack.last == '{{') {
              del();
            }
            else {
              errorList.push([getLine(i), i, this.STR("error.unmatched") + " }"]);
            }
          }
          else {
            errorList.push([getLine(i), i, this.STR("error.unmatched") + " }"]);
          }
          break;

        case '(':
          if (bracketStack.last == '"' ||
              bracketStack.last == "'" ||
              bracketStack.last == '#') {
            break;
          }
          else if (bracketStack.last == '/' || bracketStack.last == '*') {
            del();
          }
          add('(', i);
          break;

        case ')':
          if (bracketStack.last == '"' ||
              bracketStack.last == "'" ||
              bracketStack.last == '#') {
            break;
          }
          else if (bracketStack.last == '/' || bracketStack.last == '*') {
            del();
          }
          if (bracketStack.last == '(') {
            del();
          }
          else {
            errorList.push([getLine(i), i, this.STR("error.unmatched") + " )"]);
          }
          break;

        case '[':
          if (bracketStack.last == '"' ||
              bracketStack.last == "'" ||
              bracketStack.last == '#') {
            break;
          }
          else if (bracketStack.last == '/' || bracketStack.last == '*') {
            del();
          }
          if (bracketStack.last == ':') {
            errorList.push([getLine(i), i, this.STR("error.missing") + " ;"]);
            del();
          }
          add('[', i);
          break;

        case ']':
          if (bracketStack.last == '"' ||
              bracketStack.last == "'" ||
              bracketStack.last == '#') {
            break;
          }
          else if (bracketStack.last == '/' || bracketStack.last == '*') {
            del();
          }
          if (bracketStack.last == '[') {
            del();
          }
          else {
            errorList.push([getLine(i), i, this.STR("error.unmatched") + " ]"]);
          }
          break;

        case ':':
          if (bracketStack.last == '"' ||
              bracketStack.last == "'" ||
              bracketStack.last == '#') {
            break;
          }
          else if (bracketStack.last == '/' || bracketStack.last == '*') {
            del();
          }
          if (bracketStack.last == '{') {
            add(':', i);
          }
          else if (bracketStack.last == ':') {
            errorList.push([getLine(i), i, this.STR("error.missing") + " ;"]);
          }
          break;

        case ';':
          if (bracketStack.last == '"' ||
              bracketStack.last == "'" ||
              bracketStack.last == '#') {
            break;
          }
          else if (bracketStack.last == '/' || bracketStack.last == '*') {
            del();
          }
          if (bracketStack.last == ':') {
            del();
          }
          break;
        default:
          if (bracketStack.last == "*" || bracketStack.last == "/") {
            del();
          }
      }
    }

    // Checking bracklist for matching brackets
    let i = 0;
    while (i < bracketStack.length) {
      if (bracketStack[i] && bracketStack[i + 1] &&
          (((bracketStack[i] == '{' || bracketStack[i] == '{{') &&
             bracketStack[i + 1] == '}') ||
           (bracketStack[i] == '[' && bracketStack[i + 1] == ']') ||
           (bracketStack[i] == '(' && bracketStack[i + 1] == ')') ||
           (bracketStack[i] == '#' && bracketStack[i + 1] == '#') ||
           (bracketStack[i] == ':' && bracketStack[i + 1] == ';') ||
           (bracketStack[i] == "'" && bracketStack[i + 1] == "'") ||
           (bracketStack[i] == '"' && bracketStack[i + 1] == '"'))) {
        bracketStackOffset.splice(i,2);
        bracketStackLine.splice(i,2);
        bracketStack.splice(i,2);
        i = Math.max(0, i - 1);
      }
      else {
        i++;
      }
    }
    for (i = 0; i < bracketStack.length; i++) {
      errorList.push([bracketStackLine[i], bracketStackOffset[i],
                      bracketStack[i] != "#"
                        ? (bracketStack[i] != ":"
                            ? this.STR("error.unmatched") + " " + bracketStack[i].replace(/\{+/, "{")
                            : this.STR("error.missing") + " ;")
                        : this.STR("error.commentStart")]);
    }

    if (errorList.length || warningList.length) {
      error = true;
    }

    // Sorting errors based on line num
    errorList.sort(function(a,b) {
      return a[1] - b[1];
    });

    if (error) {
      let answer = previewing
                    ? false
                    : promptService.confirm(null, this.STR("validate.error"),
                                            this.STR("validate.notCSS"));
      if (!answer) {
        {
          let errorPanel = this.$("USMErrorPanel");
          while (errorPanel.firstChild) {
            errorPanel.removeChild(errorPanel.firstChild);
          }
          if (error) {
            errorList.forEach(function([lineNum, offset, msg]) {
              errorPanel.appendChild(createErrorLine(lineNum, msg, offset));
            });
            this.$("USMErrorLabel").style.opacity = 1;
            this.$("USMErrorLabel").style.margin = "0px";
            errorPanel.style.opacity = 1;
            errorPanel.style.margin = "0px";
          }
        }
        return previewing == true;
      }
      else {
        return true;
      }
    }
    else {
      this.editor.focus();
    }

    // No error found, now looking for url suffixes
    if (text.search(/[@]namespace[ ]+url\([^\)]{1,}\)/) == -1 &&
        this.namespace == null) {
      // checking if moz-url is there or not
      let mozDocURL = text.match(/[@]-moz-document[ ]+(url[\-prefix]{0,7}|domain|regexp)[ ]{0,}\(['"]?([^'"\)]+)['"]?\)[ ]/);
      if (mozDocURL != null &&
          mozDocURL[2].search("chrome://") == -1 &&
          mozDocURL[2].search("about:") == -1) {
        text = "@namespace url(http://www.w3.org/1999/xhtml);\n" + text;
        origCaretPos += 46;
      }
      else if (mozDocURL == null) {
        let button;
        if (pref("defaultNamespace") == "" ||
            !pref("defaultNamespace").match(/(xhtml|xul|none)/)) {
          let checkState = {value: false};
          let flags = promptService.BUTTON_POS_0 * promptService.BUTTON_TITLE_IS_STRING +
                      promptService.BUTTON_POS_1 * promptService.BUTTON_TITLE_IS_STRING +
                      promptService.BUTTON_POS_2 * promptService.BUTTON_TITLE_IS_STRING;
          button = promptService.confirmEx(null,
                                           this.STR("validate.title"),
                                           this.STR("validate.text"),
                                           flags,
                                           this.STR("validate.chrome"),
                                           this.STR("validate.website"),
                                           this.STR("validate.none"),
                                           this.STR("validate.setAsDefault"),
                                           checkState);
          if (checkState.value) {
            pref("defaultNamespace", button == 0
                                      ? "xul"
                                      : (button == 1
                                          ? "xhtml"
                                          : "none"));
          }
        }
        else {
          switch (pref("defaultNamespace")) {
            case "xul":
              button = 0;
              break;
            case "xhtml":
              button = 1;
              break;
            default:
              button = 2;
          }
        }

        if (button == 0) {
          // Adding a xul namespace
          text = "@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n" + text;
          this.namespace = NAMESPACE.xul;
          origCaretPos += 80;
        }
        else if (button == 1) {
          // Adding an xhtml namespace
          text = "@namespace url(http://www.w3.org/1999/xhtml);\n" + text;
          this.namespace = NAMESPACE.xhtml;
          origCaretPos += 46;
        }
        else {
          this.namespace = NAMESPACE.none;
        }
      }
      this.setText(text);
      this.win.setTimeout(function() {
        this.editor.setCursor({line: 0, ch: 0});
        this.setCaretOffset(origCaretPos);
      }.bind(this), text.length < 1000 ? 50: (text.length < 2500 ? 150: 350));
    }
    return true;
  },

  undo: function SE_undo() {
    this.editor.undo();
  },

  redo: function SE_redo() {
    this.editor.redo();
  },

  beautify: function SE_beautify() {
    let selection = this.selectedText();
    if (selection.length == 0) {
      selection = this.getText();
    }
    this.setText(cssbeautify(selection, {
                  indent:'    '.slice(Services.prefs.getIntPref("devtools.editor.tabsize"))
                }));
  },

  onTextSaved: function SE_onTextSaved(aStatus) {
    if (aStatus && !Components.isSuccessCode(aStatus)) {
      return;
    }

    if (!this.doc || !this.initialized) {
      return;  // file saved to disk after this.win has closed
    }

    this.doc.title = this.doc.title.replace(/^\*/, "");
    this.saved = true;
    this.savedOnce = true;
    this.editor.once("change", this.onTextChanged);
  },

  onTextChanged: function SE_onTextChanged() {
    this.doc.title = "*" + this.doc.title;
    this.saved = false;
  },

  onUnload: function SE_onUnload(aEvent) {
    if (aEvent.target != this.doc) {
      return;
    }

    this.resetVariables();
    this.editor.container.removeEventListener("mousemove", this.onMouseMove);
    this.editor.destroy();
    this.editor = null;
    this.initialized = false;
  },

  promptCodeBlockStyles: function SE_promptCodeBlockStyles() {

  },

  // return 0 : Save, 1 : Cancel , 2 : Don't Save
  promptSave: function SE_promptSave() {
    if ((this.styleName || this.getText() != this.initialText) &&
        !this.saved) {
      let ps = Services.prompt;
      let flags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_SAVE +
                  ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL +
                  ps.BUTTON_POS_2 * ps.BUTTON_TITLE_DONT_SAVE;
      let button = ps.confirmEx(this.win,
                                this.STR("saveDialogBox.title"),
                                this.STR("saveDialogBox.text"),
                                flags, null, null, null, null, {});
      return button;
    }
    return 2;
  },

  onClose: function SE_onClose(aEvent) {
    this.exitButtonClick(aEvent);
  },

  close: function SE_close() {
    let toClose = this.promptSave();
    if (toClose == 2) {
      if ((this.createNew || this.openNew) && !this.savedOnce) {
        styleSheetList.splice(this.index, 1);
      }
      this.resetVariables();
      this.win.close();
    }
  }
};

let styleEditor = new StyleEditor();
addEventListener("load", styleEditor.onLoad, false);
addEventListener("unload", styleEditor.onUnload, false);
addEventListener("close", styleEditor.onClose, false);
