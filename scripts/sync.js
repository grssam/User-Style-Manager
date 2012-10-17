Cu.import("resource://services-sync/engines.js");
Cu.import("resource://services-sync/record.js");
Cu.import("resource://services-sync/util.js");
Cu.import("resource://services-sync/main.js");
Cu.import("resource://services-sync/constants.js");

let trackerInstance = null;

function UserStyleRecord(collection, id) {
  CryptoWrapper.call(this, collection, id);
}

UserStyleRecord.prototype = {
  __proto__: CryptoWrapper.prototype,
};

Utils.deferGetSet(UserStyleRecord, "cleartext", ["id", "json", "code", "codeChange"]);

function UserStylesStore(name) {
  Store.call(this, name);
}

UserStylesStore.prototype = {
  __proto__: Store.prototype,

  itemExists: function (id) {
    Cu.reportError("checking ofr " + id);
    return mappedIndexForGUIDs[id] != null && mappedIndexForGUIDs[id] > -1;
  },

  createRecord: function(id, collection) {
    Cu.reportError("creating record for " + id);
    let record = new UserStyleRecord(collection, id);
    let index;
    try {
      index = mappedIndexForGUIDs[id];
    }
    catch (ex) {
      record.deleted = true;
      return record;
    }
    if (index == null || index == undefined || index < 0) {
      record.deleted = true;
      return record;
    }
    record.json = JSON.stringify(styleSheetList[index]);
    record.id = id;
    if (record.codeChange = codeChangeForIndex[index]) {
      record.code = JSON.stringify(mappedCodeForIndex[index]);
    }
    else {
      record.code = "";
    }
    codeChangeForIndex[index] = false;
    return record;
  },

  changeItemID: function(oldId, newId) {
    Cu.reportError("change id ");
    let index = mappedIndexForGUIDs[oldId];
    if (index != null && index > -1) {
      delete mappedIndexForGUIDs[oldId];
      mappedIndexForGUIDs[newId] = index;
      styleSheetList[index][9] = newId;
      writeJSONPref();
    }
  },

  getAllIDs: function() {
    Cu.reportError("get all id ");
    let guids = {};
    mappedIndexForGUIDs = {};
    for (let index = 0; index < styleSheetList.length; index++) {
      if (styleSheetList[index][9] == null) {
        styleSheetList[index][9] = Utils.makeGUID();
        writeJSONPref();
      }
      guids[styleSheetList[index][9]] = true;
      mappedIndexForGUIDs[styleSheetList[index][9]] = index;
    }
    return guids;
  },

  wipe: function() {
    for (let guid in mappedIndexForGUIDs) {
      this.remove({id: guid});
    }
  },

  create: function(record) {
  Cu.reportError("create " + record);
    this.update(record, true);
  },

  update: function(record, createNew) {Cu.reportError("update");
    let index = mappedIndexForGUIDs[record.id];
    if (createNew) {
      index = styleSheetList.length;
      if (JSON.parse(record.json)[9] == null) {
        let guid = Utils.makeGUID();
        let tempArray = JSON.parse(record.json);
        tempArray[9] = guid;
        record.json = JSON.stringify(tempArray);
        mappedIndexForGUIDs[guid] = index;
      }
      else {
        let guid = JSON.parse(record.json)[9];
        mappedIndexForGUIDs[guid] = index;
      }
    }
    if (index != null && index > -1) {
      styleSheetList[index] = JSON.parse(record.json);
      if (record.codeChange) {
        updateStyleCodeFromSync(index, JSON.parse(record.code));
      }
      writeJSONPref();
    }
  },

  remove: function(record) {Cu.reportError("remove");
    let index = mappedIndexForGUIDs[record.id];
    if (index != null && index > -1) {
      if (pref("keepDeletedOnSync")) {
        delete mappedIndexForGUIDs[record.id];
        styleSheetList[index][9] = Utils.makeGUID();
        mappedIndexForGUIDs[styleSheetList[index][9]] = index;
        writeJSONPref();
        return;
      }
      deleteStylesFromUSM([index]);
    }
  }
};

function UserStylesTracker(name) {
  Tracker.call(this, name);
Cu.reportError("engine 1");
  Services.obs.addObserver(this, "USM:codeMappings:deleted", false);
  Services.obs.addObserver(this, "USM:codeMappings:updated", false);
  trackerInstance = this;
  Cu.reportError("engine 2");
}

UserStylesTracker.prototype = {
  __proto__: Tracker.prototype,

  _enabled: true,
  observe: function observe(subject, topic, data) {
    Cu.reportError("tracket " + topic + " " + data);
    switch (topic) {

      case "USM:codeMappings:deleted":
        for each (let guid in data) {
          this._add(guid);
        }
        mappedIndexForGUIDs = {};
        for (let index = 0; index < styleSheetList.length; index++) {
          if (styleSheetList[index][9] == null) {
            styleSheetList[index][9] = Utils.makeGUID();
            writeJSONPref();
          }
          mappedIndexForGUIDs[styleSheetList[index][9]] = index;
        }
        break;

      case "USM:codeMappings:updated":
        data = data*1;
        let guid = styleSheetList[data][9];
        Cu.reportError(data + " " + typeof data + " " + styleSheetList[data][9]);
        if (guid == null || guid == undefined) {
          guid = Utils.makeGUID();
          styleSheetList[data][9] = guid;
          writeJSONPref(function() Cu.reportError("written"));
        }
        Cu.reportError(data + " " + typeof data + " " + styleSheetList);
        this._add(guid);
        break;
    }
  },

  _add: function(guid) {Cu.reportError("adding " + guid);
    if (this.addChangedID(guid) && pref("syncImmediately")) {
      this.score += SCORE_INCREMENT_XLARGE;
    }
  },

  destroy: function() {Cu.reportError("removing observers");
    Services.obs.removeObserver(this, "USM:codeMappings:deleted", false);
    Services.obs.removeObserver(this, "USM:codeMappings:updated", false);
    trackerInstance = null;
    Cu.reportError("removed");
  }
};

function UserStylesSyncEngine() {
  Weave.SyncEngine.call(this, "UserStyles");
  this.enabled = true;
  this.Name = l10n("userStyles.label");
  if (this.lastSync == null ||
      this.lastSync == undefined ||
      this.lastSync <= 0) {
    // First Time sync
    let buttons = [{
      label: l10n("mergeSyncServer.label"),
      accessKey: l10n("mergeSyncServer.accesskey"),
      tooltipText: l10n("mergeSyncServer.tooltip")
    }, {
      label: l10n("wipeServerData.label"),
      accessKey: l10n("wipeServerData.accesskey"),
      tooltipText: l10n("wipeServerData.tooltip")
    }, {
      label: l10n("wipeLocalDate.label"),
      accessKey: l10n("wipeLocalDate.accesskey"),
      tooltipText: l10n("wipeLocalDate.tooltip")
    }, {
      label: l10n("disableSync.label"),
      accessKey: l10n("disableSync.accessKey"),
      tooltipText: l10n("disableSync.tooltip")
    }];
    showNotification(l10n("firstSync.label"), l10n("firstSync.title"),
                     buttons, this.onFirstTimeChoiceSelect.bind(this));
  }
  Cu.reportError("engine");
}

UserStylesSyncEngine.prototype = {
  __proto__: Weave.SyncEngine.prototype,
  _recordObj: UserStyleRecord,
  _storeObj: UserStylesStore,
  _trackerObj: UserStylesTracker,

  prefName: "userStyles",

  get trackerInstance() trackerInstance,

  onFirstTimeChoiceSelect: function(aChoice) {
    let wasLocked = Weave.Service.locked;
    let eng = this;
    let syncAction = null;
    try {
      if (!wasLocked) {
        Weave.Service.lock();
      }
      switch(aChoice) {
        case 1:
          syncAction = function() {
            Weave.Service.resetClient([eng.name]);
            Weave.Service.wipeServer([eng.name]);
            Weave.Clients.sendCommand("wipeEngine", [eng.name]);
          };
          break;

        case 2:
          syncAction = function() {
            Weave.Service.wipeClient([eng.name]);
          }
          break;

        case 3:
          syncAction = function() {
            eng.enabled = false;
            removeSyncEngine();
            pref("syncStyles", false);
          };
          break;

        default:
          syncAction = function() {
            Weave.Service.resetClient([eng.name])
          };
          break;
      }
    } catch(ex) {
    } finally {
      if (!wasLocked) {
        Weave.Service.unlock();
      }
    }
    if (syncAction) {
      try { 
        if (eng.trackerInstance) {
          eng.trackerInstance.score += Weave.SCORE_INCREMENT_XLARGE;
        }
        syncAction();
 
      } catch (exc) {
      }
    }
  },

  destroy: function () {Cu.reportError("ending engine");
    if (this.trackerInstance) {
      this.trackerInstance.destroy();
    }
  },
};
