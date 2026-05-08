import React, { Component } from 'react';
import { LinearProgress } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigTabs from './ConfigTabs';
import ConfigPanel from './ConfigPanel';
const styles = {
    root: {
        width: '100%',
        height: '100%',
    },
};
export class JsonConfigComponent extends Component {
    forceUpdateHandlers;
    errorTimeout = null;
    errorCached = null;
    oContext;
    constructor(props) {
        super(props);
        this.state = {
            originalData: JSON.stringify(this.props.data),
            changed: false,
            errors: {},
            updateData: this.props.updateData || 0,
            systemConfig: null,
            alive: false,
            commandRunning: false,
            schema: JSON.parse(JSON.stringify(this.props.schema)),
        };
        this.forceUpdateHandlers = {};
        this.buildDependencies(this.state.schema);
        this.readData();
    }
    static getDerivedStateFromProps(props, state) {
        if (props.updateData !== state.updateData) {
            return {
                updateData: props.updateData,
                originalData: JSON.stringify(props.data),
                schema: JSON.parse(JSON.stringify(props.schema)),
            };
        }
        return null;
    }
    static async loadI18n(socket, i18n, adapterName) {
        if (i18n === true || (i18n && typeof i18n === 'string')) {
            const lang = I18n.getLanguage();
            const path = typeof i18n === 'string' ? i18n : 'i18n';
            let exists = await socket.fileExists(`${adapterName}.admin`, `${path}/${lang}.json`);
            let fileName;
            if (exists) {
                fileName = `${path}/${lang}.json`;
            }
            else {
                exists = await socket.fileExists(`${adapterName}.admin`, `${path}/${lang}/translations.json`);
                if (exists) {
                    fileName = `${path}/${lang}/translations.json`;
                }
                else if (lang !== 'en') {
                    // fallback to english
                    exists = await socket.fileExists(`${adapterName}.admin`, `${path}/en.json`);
                    if (exists) {
                        fileName = `${path}/en.json`;
                    }
                    else {
                        exists = await socket.fileExists(`${adapterName}.admin`, `${path}/en/translations.json`);
                        if (exists) {
                            fileName = `${path}/en/translations.json`;
                        }
                    }
                }
            }
            if (fileName) {
                const jsonFile = await socket.readFile(`${adapterName}.admin`, fileName);
                let jsonStr;
                if (jsonFile.file !== undefined) {
                    jsonStr = jsonFile.file;
                }
                else {
                    // @ts-expect-error deprecated
                    jsonStr = jsonFile;
                }
                try {
                    const json = JSON.parse(jsonStr);
                    // apply file to I18n
                    I18n.extendTranslations(json, lang);
                }
                catch (e) {
                    console.error(`Cannot parse language file "${adapterName}.admin/${fileName}: ${e}`);
                    return '';
                }
                return fileName;
            }
            console.warn(`Cannot find i18n for ${adapterName} / ${fileName}`);
            return '';
        }
        if (i18n && typeof i18n === 'object') {
            I18n.extendTranslations(i18n);
            return '';
        }
        return '';
    }
    onCommandRunning = (commandRunning) => this.setState({ commandRunning });
    readData() {
        void this.props.socket
            .getCompactSystemConfig()
            .then(systemConfig => this.props.socket
            .getState(`system.adapter.${this.props.adapterName}.${this.props.instance}.alive`)
            .then(state => this.setState({ systemConfig: systemConfig.common, alive: !!(state && state.val) }, () => {
            this.updateContext(true);
            if (!this.props.custom) {
                void this.props.socket.subscribeState(`system.adapter.${this.props.adapterName}.${this.props.instance}.alive`, this.onAlive);
            }
        })))
            .catch(e => console.error(`Cannot read system config: ${e}`));
    }
    onAlive = (_id, state) => {
        if (!!state?.val !== this.state.alive) {
            this.setState({ alive: !!state?.val });
        }
    };
    onChange = (attrOrData, value, cb, saveConfig) => {
        if (this.props.onValueChange) {
            this.props.onValueChange(attrOrData, value, saveConfig);
            if (cb) {
                cb();
            }
        }
        else if (attrOrData && this.props.onChange) {
            const newState = {
                changed: JSON.stringify(attrOrData) !== this.state.originalData,
            };
            this.setState(newState, () => {
                this.props.onChange(attrOrData, newState.changed, saveConfig);
                if (cb) {
                    cb();
                }
            });
        }
        else if (saveConfig) {
            this.props.onChange(null, null, saveConfig);
        }
    };
    onError = (attr, error) => {
        this.errorCached = this.errorCached || JSON.parse(JSON.stringify(this.state.errors));
        const errors = this.errorCached;
        if (error) {
            errors[attr] = error;
        }
        else {
            delete errors[attr];
        }
        if (this.errorTimeout) {
            clearTimeout(this.errorTimeout);
        }
        if (JSON.stringify(errors) !== JSON.stringify(this.state.errors)) {
            this.errorTimeout = setTimeout(() => this.setState({ errors: this.errorCached }, () => {
                this.errorTimeout = null;
                this.errorCached = null;
                this.props.onError(!!Object.keys(this.state.errors).length);
            }), 50);
        }
        else {
            this.errorCached = null;
        }
    };
    flatten(schema, _list) {
        _list = _list || {};
        if (schema.items) {
            Object.keys(schema.items).forEach(attr => {
                _list[attr] = schema.items[attr];
                this.flatten(schema.items[attr], _list);
            });
        }
        return _list;
    }
    buildDependencies(schema) {
        const attrs = this.flatten(schema);
        Object.keys(attrs).forEach(attr => {
            if (attrs[attr].confirm?.alsoDependsOn) {
                attrs[attr].confirm?.alsoDependsOn.forEach((dep) => {
                    if (!attrs[dep]) {
                        console.error(`[JsonConfigComponent] Attribute ${dep} does not exist!`);
                        if (dep.startsWith('data.')) {
                            console.warn(`[JsonConfigComponent] please use "${dep.replace(/^data\./, '')}" instead of "${dep}"`);
                        }
                    }
                    else {
                        attrs[dep].confirmDependsOn = attrs[dep].confirmDependsOn || [];
                        const depObj = { ...attrs[attr], attr };
                        if (depObj.confirm) {
                            depObj.confirm.cancel = 'Undo';
                        }
                        attrs[dep].confirmDependsOn.push(depObj);
                    }
                });
            }
            if (attrs[attr].onChange?.alsoDependsOn) {
                attrs[attr].onChange?.alsoDependsOn.forEach((dep) => {
                    if (!attrs[dep]) {
                        console.error(`[JsonConfigComponent] Attribute ${dep} does not exist!`);
                        if (dep.startsWith('data.')) {
                            console.warn(`[JsonConfigComponent] please use "${dep.replace(/^data\./, '')}" instead of "${dep}"`);
                        }
                    }
                    else {
                        attrs[dep].onChangeDependsOn = attrs[dep].onChangeDependsOn || [];
                        const depObj = { ...attrs[attr], attr };
                        attrs[dep].onChangeDependsOn.push(depObj);
                    }
                });
            }
            if (attrs[attr].hidden?.alsoDependsOn) {
                attrs[attr].hidden?.alsoDependsOn.forEach((dep) => {
                    if (!attrs[dep]) {
                        console.error(`[JsonConfigComponent] Attribute ${dep} does not exist!`);
                        if (dep.startsWith('data.')) {
                            console.warn(`[JsonConfigComponent] please use "${dep.replace(/^data\./, '')}" instead of "${dep}"`);
                        }
                    }
                    else {
                        attrs[dep].hiddenDependsOn = attrs[dep].hiddenDependsOn || [];
                        const depObj = { ...attrs[attr], attr };
                        attrs[dep].hiddenDependsOn.push(depObj);
                    }
                });
            }
            if (attrs[attr].label?.alsoDependsOn) {
                attrs[attr].label?.alsoDependsOn.forEach((dep) => {
                    if (!attrs[dep]) {
                        console.error(`[JsonConfigComponent] Attribute ${dep} does not exist!`);
                        if (dep.startsWith('data.')) {
                            console.warn(`[JsonConfigComponent] please use "${dep.replace(/^data\./, '')}" instead of "${dep}"`);
                        }
                    }
                    else {
                        attrs[dep].labelDependsOn = attrs[dep].labelDependsOn || [];
                        const depObj = { ...attrs[attr], attr };
                        attrs[dep].labelDependsOn.push(depObj);
                    }
                });
            }
            if (attrs[attr].help?.alsoDependsOn) {
                attrs[attr].help?.alsoDependsOn.forEach((dep) => {
                    if (!attrs[dep]) {
                        console.error(`[JsonConfigComponent] Attribute ${dep} does not exist!`);
                        if (dep.startsWith('data.')) {
                            console.warn(`[JsonConfigComponent] please use "${dep.replace(/^data\./, '')}" instead of "${dep}"`);
                        }
                    }
                    else {
                        attrs[dep].helpDependsOn = attrs[dep].helpDependsOn || [];
                        const depObj = { ...attrs[attr], attr };
                        attrs[dep].helpDependsOn.push(depObj);
                    }
                });
            }
        });
    }
    updateContext(forceUpdate) {
        this.oContext = {
            DeviceManager: this.props.DeviceManager,
            adapterName: this.props.adapterName,
            changeLanguage: this.changeLanguage,
            common: this.props.common,
            customs: this.props.customs,
            dateFormat: this.props.dateFormat,
            embedded: this.props.embedded,
            forceUpdate: this.forceAttrUpdate,
            imagePrefix: this.props.imagePrefix,
            instance: this.props.instance,
            instanceObj: this.props.instanceObj,
            isFloatComma: this.props.isFloatComma,
            multiEdit: this.props.multiEdit,
            onBackEndCommand: this.props.onBackEndCommand,
            onCommandRunning: this.onCommandRunning,
            onValueChange: this.props.onValueChange,
            registerOnForceUpdate: this.registerOnForceUpdate,
            socket: this.props.socket,
            systemConfig: this.state.systemConfig,
            theme: this.props.theme,
            // could be changed dynamically
            themeType: this.props.themeType,
            _themeName: this.props.themeName,
            updateData: this.state.updateData,
        };
        if (forceUpdate) {
            this.forceUpdate();
        }
    }
    renderItem(item) {
        if (item.type === 'tabs') {
            return (React.createElement(ConfigTabs, { withoutSaveButtons: this.props.withoutSaveButtons, oContext: this.oContext, alive: this.state.alive, changed: this.state.changed, commandRunning: this.state.commandRunning, common: this.props.common, custom: this.props.custom, customObj: this.props.customObj, data: this.props.data, onChange: this.onChange, onError: (attr, error) => this.onError(attr, error), originalData: JSON.parse(this.state.originalData), root: true, schema: item, expertMode: this.props.expertMode, themeName: this.props.themeName }));
        }
        if (item.type === 'panel' ||
            // @ts-expect-error type could be empty
            !item.type) {
            return (React.createElement(ConfigPanel, { withoutSaveButtons: this.props.withoutSaveButtons, oContext: this.oContext, alive: this.state.alive, changed: this.state.changed, commandRunning: this.state.commandRunning, common: this.props.common, custom: this.props.custom, customObj: this.props.customObj, data: this.props.data, expertMode: this.props.expertMode, index: 1000, isParentTab: !this.props.embedded && !this.props.withoutSaveButtons, onChange: this.onChange, onError: (attr, error) => this.onError(attr, error), originalData: JSON.parse(this.state.originalData), root: true, schema: item, themeName: this.props.themeName }));
        }
        console.error(`Unknown item type in root: ${JSON.stringify(item)}`);
        return null;
    }
    changeLanguage = () => {
        this.forceUpdate();
    };
    forceAttrUpdate = (attr, data) => {
        if (Array.isArray(attr)) {
            attr.forEach(a => this.forceUpdateHandlers[a] && this.forceUpdateHandlers[a](data));
        }
        else if (this.forceUpdateHandlers[attr]) {
            this.forceUpdateHandlers[attr](data);
        }
    };
    registerOnForceUpdate = (attr, cb) => {
        if (cb) {
            this.forceUpdateHandlers[attr] = cb;
        }
        else if (this.forceUpdateHandlers[attr]) {
            delete this.forceUpdateHandlers[attr];
        }
    };
    render() {
        if (!this.state.systemConfig || !this.oContext) {
            return React.createElement(LinearProgress, null);
        }
        if (this.oContext._themeName !== this.props.themeName) {
            this.oContext._themeName = this.props.themeName;
            setTimeout(() => this.updateContext(true), 0);
        }
        return (React.createElement("div", { style: {
                ...(!this.props.embedded || this.props.withoutSaveButtons ? styles.root : undefined),
                ...this.props.style,
                ...this.state.schema.style,
            } }, this.renderItem(this.state.schema)));
    }
}
export default JsonConfigComponent;
//# sourceMappingURL=index.js.map