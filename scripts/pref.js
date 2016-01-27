/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * The original code is the helper and utils file for addon Speak Words.
 *
 * Contributor:
 *   Girish Sharma <scrapmachines@gmail.com>
 */

"use strict";

function pref(key, val) {
  // Cache the prefbranch after first use
  let {branch, defaults} = pref;
  if (branch == null)
    branch = Services.prefs.getBranch(pref.root);

  // Figure out what type of pref to fetch/feed
  if (val == null)
    switch (typeof defaults[key]) {
      case "boolean":
        return branch.getBoolPref(key);
      case "number":
        return branch.getIntPref(key);
      case "string":
        return branch.getCharPref(key);
    }
  else
    switch (typeof defaults[key]) {
      case "boolean":
        branch.setBoolPref(key, val);
        break;
      case "number":
        branch.setIntPref(key, val);
        break;
      case "string":
        branch.setCharPref(key, val);
        break;
    }
  return null;
}

// Set custom values for this add-on
pref.root = "extensions.UserStyleManager.";
pref.defaults = {
  userStyleList: "[]",
  maintainBackup: true,
  fallBack: true,
  firstRun: true,
  editorOpen: false,
  sortColumn: -1,
  sortOrder: 0,
  hideOptionsWhileEditing: true,
  createToolsMenuButton: true,
  createAppMenuButton: true,
  createToolbarButton: true,
  createContextMenuEntry: true,
  shortcutKey: "U",
  shortcutModifiers: "accel, shift",
  createHotKey: true,
  buttonParentID: "",
  buttonNextSiblingID: "",
  deleteFromDisk: false,
  stylesEnabled: true,
  updateAutomatically: true,
  updateOverwritesLocalChanges: false,
  lastUpdatedOn: "0",
  updateTimeoutActive: false,
  syncStyles: true,
  keepDeletedOnSync: false,
  defaultNamespace: "",
  syncImmediately: false,
  editingOptions: '{"codeBlockStyle":{}}',
};

pref.observe = function(prefs, callback) {
  let {root} = pref;
  function observe(subject, topic, data) {
    // Sanity check that we have the right notification
    if (topic != "nsPref:changed")
      return;

    // Only care about the prefs provided
    let pref = data.slice(root.length);
    if (prefs.indexOf(pref) == -1)
      return;

    // Trigger the callback with the changed key
    callback(pref);
  }

  // Watch for preference changes under the root and clean up when necessary
  Services.prefs.addObserver(root, observe, false);
  unload(function() Services.prefs.removeObserver(root, observe));
};

// Initialize default preferences
{
  let branch = Services.prefs.getDefaultBranch(pref.root);
  for (let [key, val] in Iterator(pref.defaults)) {
    switch (typeof val) {
      case "boolean":
        branch.setBoolPref(key, val);
        break;
      case "number":
        branch.setIntPref(key, val);
        break;
      case "string":
        branch.setCharPref(key, val);
        break;
    }
  }
}

function setPref(k, v) {
  {
    let branch = Services.prefs.getDefaultBranch(pref.root);
    switch (typeof v) {
      case "boolean":
        branch.setBoolPref(k, v);
        break;
      case "number":
        branch.setIntPref(k, v);
        break;
      case "string":
        branch.setCharPref(k, v);
        break;
    }
  }
}
