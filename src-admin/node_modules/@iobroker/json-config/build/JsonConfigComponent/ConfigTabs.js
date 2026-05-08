import React from 'react';
import { Tabs, Tab, IconButton, Toolbar, Menu, MenuItem, ListItemIcon, Box } from '@mui/material';
import { Menu as MenuIcon, Error as ErrorIcon } from '@mui/icons-material';
import ConfigGeneric from './ConfigGeneric';
import ConfigPanel from './ConfigPanel';
const styles = {
    tabs: {
        height: '100%',
        width: '100%',
    },
    panel: {
        width: '100%',
        display: 'block',
    },
    panelWithIcons: {
        height: 'calc(100% - 72px)',
    },
    panelWithoutIcons: {
        height: 'calc(100% - 48px)',
    },
};
class ConfigTabs extends ConfigGeneric {
    resizeTimeout = null;
    refDiv;
    constructor(props) {
        super(props);
        let tab;
        if (this.props.root) {
            // read the path from hash
            // #tab-instances/config/system.adapter.ping.0/<TAB-NAME-OR-INDEX>
            const hash = (window.location.hash || '').replace(/^#/, '').split('/');
            if (hash.length >= 3 && hash[1] === 'config') {
                const tabS = hash[3];
                const tabN = parseInt(tabS, 10);
                if (tabS && tabN.toString() === tabS) {
                    if (tabN >= 0 && tabN < Object.keys(this.props.schema.items).length) {
                        tab = Object.keys(this.props.schema.items)[tabN];
                    }
                }
                else if (tabS && Object.keys(this.props.schema.items).includes(tabS)) {
                    tab = tabS;
                }
                // install on hash change handler
                window.addEventListener('hashchange', this.onHashTabsChanged, false);
            }
        }
        if (tab === undefined) {
            tab =
                (window._localStorage || window.localStorage).getItem(`${this.props.dialogName || 'App'}.${this.props.oContext.adapterName}`) || Object.keys(this.props.schema.items)[0];
            if (!Object.keys(this.props.schema.items).includes(tab)) {
                tab = Object.keys(this.props.schema.items)[0];
            }
        }
        this.refDiv = React.createRef();
        Object.assign(this.state, { tab, width: 0, openMenu: null, tabErrors: {} });
    }
    onTabError = (attr, error) => {
        const currentTab = this.state.tab;
        if (!currentTab) {
            // Forward to parent if no current tab
            this.props.onError(attr, error);
            return;
        }
        const newTabErrors = { ...this.state.tabErrors };
        if (!newTabErrors[currentTab]) {
            newTabErrors[currentTab] = {};
        }
        if (!error) {
            delete newTabErrors[currentTab][attr];
            // Clean up empty tab error objects
            if (Object.keys(newTabErrors[currentTab]).length === 0) {
                delete newTabErrors[currentTab];
            }
        }
        else {
            newTabErrors[currentTab][attr] = error;
        }
        this.setState({ tabErrors: newTabErrors });
        // Also forward to parent
        this.props.onError(attr, error);
    };
    hasTabErrors = (tabName) => {
        return !!(this.state.tabErrors[tabName] && Object.keys(this.state.tabErrors[tabName]).length > 0);
    };
    componentWillUnmount() {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        window.removeEventListener('hashchange', this.onHashTabsChanged, false);
        super.componentWillUnmount();
    }
    onHashTabsChanged = () => {
        const hash = (window.location.hash || '').replace(/^#/, '').split('/');
        if (hash.length > 3 && hash[1] === 'config') {
            const tabS = hash[3];
            const tabN = parseInt(tabS, 10);
            let tab;
            if (tabN.toString() === tabS) {
                if (tabN >= 0 && tabN < Object.keys(this.props.schema.items).length) {
                    tab = Object.keys(this.props.schema.items)[tabN];
                }
            }
            else if (Object.keys(this.props.schema.items).includes(tabS)) {
                tab = tabS;
            }
            if (tab !== undefined && tab !== this.state.tab) {
                (window._localStorage || window.localStorage).setItem(`${this.props.dialogName || 'App'}.${this.props.oContext.adapterName}`, tab);
                this.setState({ tab });
            }
        }
    };
    getCurrentBreakpoint() {
        if (!this.state.width) {
            return 'md';
        }
        if (!this.state.initialBreakpoint) {
            let initialBreakpoint;
            if (this.state.width < 600) {
                initialBreakpoint = 'xs';
            }
            else if (this.state.width < 900) {
                initialBreakpoint = 'sm';
            }
            else if (this.state.width < 1200) {
                initialBreakpoint = 'md';
            }
            else if (this.state.width < 1536) {
                initialBreakpoint = 'lg';
            }
            else {
                initialBreakpoint = 'xl';
            }
            // Remember initial breakpoint and do not change it anymore
            setTimeout(() => {
                this.setState({ initialBreakpoint });
            }, 50);
            return initialBreakpoint;
        }
        return this.state.initialBreakpoint;
    }
    componentDidUpdate() {
        if (!this.state.initialBreakpoint &&
            this.refDiv.current?.clientWidth &&
            this.refDiv.current.clientWidth !== this.state.width) {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = setTimeout(() => {
                this.resizeTimeout = null;
                this.setState({ width: this.refDiv.current?.clientWidth });
            }, 50);
        }
    }
    onMenuChange(tab) {
        (window._localStorage || window.localStorage).setItem(`${this.props.dialogName || 'App'}.${this.props.oContext.adapterName}`, tab);
        this.setState({ tab }, () => {
            if (this.props.root) {
                const hash = (window.location.hash || '').split('/');
                if (hash.length >= 3 && hash[1] === 'config') {
                    hash[3] = this.state.tab;
                    window.location.hash = hash.join('/');
                }
            }
        });
    }
    render() {
        const items = this.props.schema.items;
        let withIcons = false;
        const elements = [];
        Object.keys(items).map(name => {
            let disabled;
            if (items[name].expertMode && !this.props.expertMode) {
                return;
            }
            if (this.props.custom) {
                const hidden = this.executeCustom(items[name].hidden, this.props.data, this.props.customObj, this.props.oContext.instanceObj, this.props.index, this.props.globalData);
                if (hidden) {
                    return;
                }
                disabled = this.executeCustom(items[name].disabled, this.props.data, this.props.customObj, this.props.oContext.instanceObj, this.props.index, this.props.globalData);
            }
            else {
                const hidden = this.execute(items[name].hidden, false, this.props.data, this.props.index, this.props.globalData);
                if (hidden) {
                    return;
                }
                disabled = this.execute(items[name].disabled, false, this.props.data, this.props.index, this.props.globalData);
            }
            const icon = this.getIcon(items[name].icon);
            withIcons = withIcons || !!icon;
            elements.push({ icon, disabled, label: this.getText(items[name].label), name });
        });
        if (!elements.find(item => item.name === this.state.tab)) {
            // Select the first tab if the current tab is not available
            setTimeout(() => this.setState({ tab: elements[0].name }), 50);
        }
        const currentBreakpoint = this.getCurrentBreakpoint();
        let tabs;
        if (currentBreakpoint === 'xs' && elements.length > 2) {
            tabs = (React.createElement(Toolbar, { style: {
                    top: 2,
                    backgroundColor: this.props.oContext.themeType === 'dark' ? '#222' : '#DDD',
                }, variant: "dense" },
                React.createElement(IconButton, { onClick: (event) => this.setState({ openMenu: event.currentTarget }) },
                    React.createElement(MenuIcon, null)),
                this.state.openMenu ? (React.createElement(Menu, { open: !0, anchorEl: this.state.openMenu, onClose: () => this.setState({ openMenu: null }) }, elements.map(el => {
                    const hasErrors = this.hasTabErrors(el.name);
                    return (React.createElement(MenuItem, { disabled: el.disabled, key: el.name, onClick: () => {
                            this.setState({ openMenu: null }, () => this.onMenuChange(el.name));
                        }, selected: el.name === this.state.tab, sx: hasErrors ? { color: 'error.main' } : undefined },
                        withIcons ? React.createElement(ListItemIcon, null, el.icon) : null,
                        React.createElement(Box, { sx: { display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' } },
                            el.label,
                            hasErrors && React.createElement(ErrorIcon, { sx: { fontSize: 16, color: 'error.main' } }))));
                }))) : null));
        }
        else {
            tabs = (React.createElement(Tabs, { variant: "scrollable", scrollButtons: "auto", style: this.props.schema.tabsStyle, value: this.state.tab, onChange: (_e, tab) => this.onMenuChange(tab) }, elements.map(el => {
                const hasErrors = this.hasTabErrors(el.name);
                const label = hasErrors ? (React.createElement(Box, { sx: { display: 'flex', alignItems: 'center', gap: 0.5 } },
                    el.label,
                    React.createElement(ErrorIcon, { sx: { fontSize: 16, color: 'error.main' } }))) : (el.label);
                return (React.createElement(Tab, { id: el.name, wrapped: true, disabled: el.disabled, key: el.name, value: el.name, iconPosition: this.props.schema.iconPosition || 'start', icon: el.icon, label: label, sx: hasErrors ? { '& .MuiTab-wrapper': { color: 'error.main' } } : undefined }));
            })));
        }
        return (React.createElement("div", { style: styles.tabs, ref: this.refDiv },
            tabs,
            React.createElement(ConfigPanel, { oContext: this.props.oContext, withoutSaveButtons: this.props.withoutSaveButtons, isParentTab: true, changed: this.props.changed, key: this.state.tab, expertMode: this.props.expertMode, index: 1001, arrayIndex: this.props.arrayIndex, globalData: this.props.globalData, commandRunning: this.props.commandRunning, style: {
                    ...styles.panel,
                    ...(withIcons ? styles.panelWithIcons : styles.panelWithoutIcons),
                }, common: this.props.common, alive: this.props.alive, themeName: this.props.themeName, data: this.props.data, originalData: this.props.originalData, onChange: this.props.onChange, onError: this.onTabError, customObj: this.props.customObj, custom: this.props.custom, schema: items[this.state.tab], table: this.props.table, withIcons: withIcons })));
    }
}
export default ConfigTabs;
//# sourceMappingURL=ConfigTabs.js.map