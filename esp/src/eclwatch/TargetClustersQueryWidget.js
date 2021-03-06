define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/i18n",
    "dojo/i18n!./nls/hpcc",
    "dojo/_base/array",
    "dojo/on",
    "dojo/dom",
    "dojo/dom-class",
    "dojo/dom-construct",
    "dojo/topic",

    "dijit/registry",
    "dijit/form/Button",
    "dijit/ToolbarSeparator",
    "dijit/Dialog",
    "dijit/form/TextBox",

    "dgrid/tree",
    "dgrid/selector",

    "hpcc/GridDetailsWidget",
    "hpcc/PreflightDetailsWidget",
    "src/ESPPreflight",
    "src/ESPRequest",
    "src/WsTopology",
    "src/WsESDLConfig",
    "src/Utility",
    "hpcc/DelayLoadWidget",
    "src/ESPUtil",
    "hpcc/DynamicESDLDefinitionQueryWidget",
    "hpcc/TargetSelectWidget",
    "hpcc/MachineInformationWidget",
    "hpcc/IFrameWidget"
], function (declare, lang, i18n, nlsHPCC, arrayUtil, on, dom, domClass, domConstruct, topic,
    registry, Button, ToolbarSeparator, Dialog, TextBox,
    tree, selector,
    GridDetailsWidget, PreflightDetailsWidget, ESPPreflight, ESPRequest, WsTopology, WsESDLConfig, Utility, DelayLoadWidget, ESPUtil, DynamicESDLDefinitionQueryWidget, TargetSelectWidget, MachineInformationWidget, IFrameWidget) {
    return declare("TargetClustersQueryWidget", [GridDetailsWidget, ESPUtil.FormHelper], {
        i18n: nlsHPCC,

        gridTitle: nlsHPCC.title_TargetClusters,
        idProperty: "__hpcc_id",
        machineFilter: null,
        machineFilterLoaded: null,

        init: function (params) {
            var context = this;
            if (this.inherited(arguments))
                return;

            this.machineFilter.on("apply", function (evt) {
                var selection = context.grid.getSelected();
                context.machineFilter._onSubmitRequest("targets", selection);
            });

            topic.subscribe("createTargetClusterPreflightTab", function (topic) {
                var pfTab = context.ensureTCPane(topic.response.TargetClusterInfoList.TargetClusterInfo[0].Name + topic.response.TimeStamp, {
                    params: topic.response
                });
                pfTab.init(topic.response, "cluster");
            });

            dojo.destroy(this.id + "Open");
            this.refreshGrid();
            this.refreshActionState();
        },

        initTab: function () {
            var currSel = this.getSelectedChild();
            if (currSel && !currSel.initalized) {
                if (currSel.id === this.id + "_Grid") {
                    this.refreshGrid()
                } else if (currSel.id === this.legacyTargetClustersIframeWidget.id && !this.legacyTargetClustersIframeWidget.initalized) {
                    this.legacyTargetClustersIframeWidget.init({
                        src: ESPRequest.getBaseURL("WsTopology") + "/TpTargetClusterQuery?Type=ROOT"
                    });
                } else if (currSel.params.newPreflight || currSel.params.Usergenerated) { //prevents loop of pfTab.init above
                    currSel.init(currSel.params);
                }
            }
        },

        postCreate: function (args) {
            var context = this;
            this.inherited(arguments);
            this.openButton = registry.byId(this.id + "Open");
            this.refreshButton = registry.byId(this.id + "Refresh");
            this.configurationButton = registry.byId(this.id + "Configuration");

            this.machineFilter = new MachineInformationWidget({});

            this.configurationButton = new Button({
                label: this.i18n.OpenConfiguration,
                onClick: function(event) {
                    context._onOpenConfiguration()
                }
            });

            this.machineFilter.placeAt(this.openButton.domNode, "after");
            this.configurationButton.placeAt(this.openButton.domNode, "after");

            new ToolbarSeparator().placeAt(this.machineFilter.domNode, "before");

            this.machineFilter.machineForm.set("style", "width:500px;");
            this.machineFilter.disable(true);
            dojo.destroy(this.id + "Open");

            this.legacyTargetClustersIframeWidget = new IFrameWidget({
                id: this.id + "_LegacyTargetClustersIframeWidget",
                title: this.i18n.TargetClustersLegacy,
                style: "border: 0; width: 100%; height: 100%"
            });
            this.legacyTargetClustersIframeWidget.placeAt(this._tabContainer, "last");
            this.machineFilter.disable();
        },

        createGrid: function (domID) {
            var context = this;
            var retVal = new declare([ESPUtil.Grid(true, true, false, true)])({
                store: ESPPreflight.CreateTargetClusterStore(),
                columns: {
                    col1: selector({
                        width: 20,
                        selectorType: 'checkbox'
                    }),
                    Configuration: {
                        label: this.i18n.Configuration,
                        renderHeaderCell: function (node) {
                            node.innerHTML = Utility.getImageHTML("configuration.png", context.i18n.Configuration);
                        },
                        width: 10,
                        sortable: false,
                        formatter: function (configuration) {
                            if (configuration === true) {
                                return "<a href='#' />" + Utility.getImageHTML("configuration.png", context.i18n.Configuration) + "</a>";
                            }
                            return "";
                        }
                    },
                    Name: tree({
                        formatter: function (_name, row) {
                            var img = "";
                            var name = _name;
                            if (row.type === "targetClusterComponent") {
                                name = "<a href='#' class='dgrid-row-url'>" + row.Netaddress + " - " + _name + "</a>";
                            }
                            return img + "&nbsp;" + name;
                        },
                        expand: true,
                        label: this.i18n.Name,
                        collapseOnRefresh: false,
                        sortable: true,
                        width: 150,
                        shouldExpand: function (clusterProcess) {
                            if (clusterProcess.data.type === "targetClusterProcess") {
                                return true;
                            }
                            return false;
                        }
                    }),
                    Node: {
                        label: this.i18n.Node,
                        sortable: false,
                        width: 100
                    },
                    Platform: {
                        label: this.i18n.Platform,
                        sortable: false,
                        width: 75
                    },
                    Directory: {
                        label: this.i18n.Directory,
                        sortable: false,
                        width: 200
                    },
                }
            }, domID);

            retVal.on(".dgrid-row-url:click", function (evt) {
                if (context._onRowDblClick) {
                    var item = retVal.row(evt).data;
                    context._onRowDblClick(item);
                }
            });

            retVal.on(".dgrid-row:dblclick", function (evt) {
                if (context._onRowDblClick) {
                    var item = retVal.row(evt).data;
                    context._onRowDblClick(item);
                }
            });

            retVal.on("dgrid-select", function (event) {
                context.refreshActionState();
            });
            retVal.on("dgrid-deselect", function (event) {
                context.refreshActionState();
            });

            return retVal;
        },

        _onRefresh: function () {
            this.refreshGrid();
        },

        refreshGrid: function () {
            this.grid.set("query", {
                Type: "ROOT",
            });
        },

        _onOpenConfiguration: function (event) {
            var context = this;
            var selections = this.grid.getSelected();
            var firstTab = null;
            for (var i = 0; i < selections.length; ++i) {
                var data = this.grid.row(selections[i].hpcc_id).data;
                WsTopology.TpGetComponentFile({
                    request: {
                        NetAddress: data.Netaddress,
                        FileType: "cfg",
                        Directory: data.Directory,
                        CompType: data.Type,
                        OsType: data.OS,
                    }
                }).then(function(response) {
                    var tab = context.ensureConfigurationPane(data.Parent.Name + "-" + data.Type , {
                        Component: data.Type,
                        Name: data.Parent.Name,
                        Usergenerated: response
                    });
                    if (i === 0) {
                        firstTab = tab;
                    }
                });
            }
            if (firstTab) {
                this.selectChild(firstTab);
            }
        },

        _onRowDblClick: function (item) {
            var nodeTab = this.ensureLogsPane(item.Name, {
                params: item,
                LogDirectory: item.LogDirectory,
                NetAddress: item.Netaddress,
                OS: item.OS,
                newPreflight: true
            });
            this.selectChild(nodeTab);
        },

        refreshActionState: function () {
            var selection = this.grid.getSelected();
            var isTarget = false;
            var isProcess = false;

            for (var i = 0; i < selection.length; ++i) {
                if (selection[i] && selection[i].type === "targetClusterProcess") {
                    isTarget = true;
                    isProcess = false;

                } else {
                    isTarget = false;
                    isProcess = true;
                }
            }

            this.machineFilter.disable(!isTarget);
            this.configurationButton.set("disabled", !isProcess);
        },

        ensureConfigurationPane: function (id, params) {
            id = this.createChildTabID(id);
            var retVal = registry.byId(id);
            if (!retVal) {
                var context = this;
                retVal = new DelayLoadWidget({
                    id: id,
                    title: "<b>" + params.Name + "</b>: " + params.Component + " " + context.i18n.Configuration,
                    closable: true,
                    delayWidget: "ECLSourceWidget",
                    params: params
                });
                this.addChild(retVal, "last");
            }
            return retVal;
        },

        ensureLogsPane: function (id, params) {
            id = this.createChildTabID(id);
            var retVal = registry.byId(id);
            if (!retVal) {
                retVal = new DelayLoadWidget({
                    id: id,
                    title: "<b>" + params.NetAddress + "</b>: " + params.LogDirectory,
                    closable: true,
                    delayWidget: "LogWidget",
                    params: params
                });
                this.addChild(retVal, "last");
            }
            return retVal;
        },

        ensureTCPane: function (id, params) {
            id = this.createChildTabID(id);
            var retVal = registry.byId(id);
            if (!retVal) {
                retVal = new PreflightDetailsWidget({
                    id: id,
                    title: this.i18n.Fetched + ": " + params.params.TimeStamp,
                    closable: true,
                    params: params.params
                });
                this._tabContainer.addChild(retVal, "last");
            }
            return retVal;
        }
    });
});