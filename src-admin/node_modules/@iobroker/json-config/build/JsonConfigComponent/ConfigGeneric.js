import React, { Component } from 'react';
import { Grid2, Button } from '@mui/material';
import { Info as IconInfo, Warning as IconWarning, Error as IconError, Key as IconAuth, Send as IconSend, Public as IconWeb, Search as IconSearch, MenuBook as IconMenuBook, Help as IconHelp, UploadFile as IconUploadFile, Edit as IconEdit, Person as IconPerson, Group as IconGroup, Delete as IconDelete, Refresh as IconRefresh, Add as IconAdd, LinkOff as IconLinkOff, Link as LinkIcon, Save, OpenInNew, } from '@mui/icons-material';
import { DialogConfirm, Icon, Utils, I18n, } from '@iobroker/adapter-react-v5';
const DEFAULT_SM_SIZE = window.innerWidth <= 600 ? 12 : undefined;
// because this class is used in react-components, do not include here any foreign files like from '../../helpers/utils.ts'
export function isObject(it) {
    // This is necessary because:
    // typeof null === 'object'
    // typeof [] === 'object'
    // [] instanceof Object === true
    return Object.prototype.toString.call(it) === '[object Object]'; // this code is 25% faster than below one
    // return it && typeof it === 'object' && !(it instanceof Array);
}
export default class ConfigGeneric extends Component {
    static DIFFERENT_VALUE = '__different__';
    static DIFFERENT_LABEL = 'ra___different__';
    static NONE_VALUE = '';
    static NONE_LABEL = 'ra_none';
    defaultValue;
    isError;
    lang;
    defaultSendToDone;
    sendToTimeout;
    noPlaceRequired;
    constructor(props) {
        super(props);
        // @ts-expect-error of course, as we just
        this.state = {
            confirmDialog: false,
            confirmNewValue: null,
            confirmAttr: null,
            confirmData: null,
            confirmCallback: null,
        };
        this.isError = {};
        if (props.schema) {
            if (props.custom) {
                this.defaultValue = props.schema.defaultFunc
                    ? this.executeCustom(props.schema.defaultFunc, props.data, props.customObj, props.oContext.instanceObj, props.arrayIndex, props.globalData)
                    : props.schema.default;
            }
            else if (props.schema.type !== 'state') {
                this.defaultValue = props.schema.defaultFunc
                    ? this.execute(props.schema.defaultFunc, props.schema.default, props.data, props.arrayIndex, props.globalData)
                    : props.schema.default;
            }
        }
        this.lang = I18n.getLanguage();
    }
    componentDidMount() {
        if (this.props.oContext.registerOnForceUpdate) {
            this.props.oContext.registerOnForceUpdate(this.props.attr, this.onUpdate);
        }
        const LIKE_SELECT = ['select', 'autocomplete', 'autocompleteSendTo'];
        // init default value
        if (this.defaultValue !== undefined) {
            const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
            if (value === undefined ||
                (LIKE_SELECT.includes(this.props.schema.type) && (value === '' || value === null))) {
                setTimeout(() => {
                    if (this.props.custom) {
                        this.props.onChange(this.props.attr, this.defaultValue, () => setTimeout(() => this.props.oContext.forceUpdate([this.props.attr], this.props.data), 100));
                    }
                    else {
                        ConfigGeneric.setValue(this.props.data, this.props.attr, this.defaultValue);
                        this.props.onChange(this.props.data, undefined, () => this.props.oContext.forceUpdate([this.props.attr], this.props.data));
                    }
                }, 100);
            }
        }
        else if (this.props.schema.defaultSendTo) {
            this.sendTo();
        }
    }
    sendTo() {
        if (this.props.alive) {
            this.defaultSendToDone = true;
            let data = this.props.schema.data;
            if (data === undefined && this.props.schema.jsonData) {
                const dataStr = this.getPattern(this.props.schema.jsonData, null, true);
                try {
                    data = JSON.parse(dataStr);
                }
                catch {
                    console.error(`Cannot parse json data: ${dataStr}`);
                }
            }
            else {
                data = {
                    attr: this.props.attr,
                    value: ConfigGeneric.getValue(this.props.data, this.props.attr),
                };
            }
            if (data === undefined) {
                data = null;
            }
            void this.props.oContext.socket
                .sendTo(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, this.props.schema.defaultSendTo, data)
                .then((value) => {
                if (value !== null && value !== undefined) {
                    if (this.props.custom) {
                        this.props.onChange(this.props.attr, value, () => this.props.oContext.forceUpdate([this.props.attr], this.props.data));
                    }
                    else {
                        ConfigGeneric.setValue(this.props.data, this.props.attr, value);
                        this.props.onChange(this.props.data, undefined, () => this.props.oContext.forceUpdate([this.props.attr], this.props.data));
                    }
                }
            });
        }
        else {
            this.defaultSendToDone = false;
            if (!this.props.schema.allowSaveWithError) {
                // show error, that instance did not start
                this.onError(this.props.attr, I18n.t('ra_Instance %s is not alive', this.props.oContext.instance.toString()));
            }
        }
    }
    componentWillUnmount() {
        if (this.props.oContext.registerOnForceUpdate) {
            this.props.oContext.registerOnForceUpdate(this.props.attr);
        }
        if (this.sendToTimeout) {
            clearTimeout(this.sendToTimeout);
            this.sendToTimeout = null;
        }
    }
    onUpdate = (data) => {
        const value = ConfigGeneric.getValue(data || this.props.data, this.props.attr) || '';
        if (this.state.value !== value) {
            this.setState({ value });
        }
        else {
            this.forceUpdate();
        }
    };
    /**
     * Extract attribute out of data
     */
    static getValue(data, attr) {
        if (typeof attr === 'string') {
            return ConfigGeneric.getValue(data, attr.split('.'));
        }
        if (attr.length === 1) {
            return data[attr[0]];
        }
        const part = attr.shift();
        if (typeof part === 'string' && typeof data[part] === 'object') {
            return ConfigGeneric.getValue(data[part], attr);
        }
        return undefined;
    }
    static setValue(data, attr, value) {
        if (typeof attr === 'string') {
            ConfigGeneric.setValue(data, attr.split('.'), value);
            return;
        }
        if (attr.length === 1) {
            if (value === null) {
                delete data[attr[0]];
            }
            else {
                data[attr[0]] = value;
            }
        }
        else {
            const part = attr.shift();
            if (typeof part !== 'string') {
                return;
            }
            if (!data[part] || typeof data[part] === 'object') {
                data[part] = data[part] || {};
            }
            ConfigGeneric.setValue(data[part], attr, value);
        }
    }
    getText(text, noTranslation) {
        if (!text) {
            return '';
        }
        if (typeof text === 'string') {
            const strText = noTranslation ? text : I18n.t(text);
            if (strText.includes('${')) {
                return this.getPattern(strText, null, noTranslation);
            }
            return strText;
        }
        if (isObject(text)) {
            // todo
            if (text.func) {
                // calculate pattern
                if (typeof text.func === 'object') {
                    return this.getPattern(text.func[this.lang] || text.func.en || '', null, true);
                }
                return this.getPattern(text.func, null, noTranslation);
            }
            return text[this.lang] || text.en || '';
        }
        return text.toString();
    }
    renderDialogConfirm() {
        if (!this.state.confirmDialog) {
            return null;
        }
        const confirm = this.state.confirmData || this.props.schema.confirm;
        let icon = null;
        if (confirm.type === 'warning') {
            icon = React.createElement(IconWarning, null);
        }
        else if (confirm.type === 'error') {
            icon = React.createElement(IconError, null);
        }
        else if (confirm.type === 'info') {
            icon = React.createElement(IconInfo, null);
        }
        return (React.createElement(DialogConfirm, { title: this.getText(confirm.title) || I18n.t('ra_Please confirm'), text: this.getText(confirm.text), ok: this.getText(confirm.ok) || I18n.t('ra_Ok'), cancel: this.getText(confirm.cancel) || I18n.t('ra_Cancel'), icon: icon || undefined, onClose: isOk => this.setState({ confirmDialog: false }, () => {
                if (isOk) {
                    if (this.state.confirmCallback) {
                        const callback = this.state.confirmCallback;
                        this.setState({ confirmCallback: null }, () => callback(true));
                        return;
                    }
                    const data = JSON.parse(JSON.stringify(this.props.data));
                    if (this.state.confirmDepAttr) {
                        ConfigGeneric.setValue(data, this.state.confirmDepAttr, this.state.confirmDepNewValue);
                    }
                    ConfigGeneric.setValue(data, this.state.confirmAttr, this.state.confirmNewValue);
                    this.setState({
                        confirmDialog: false,
                        confirmDepAttr: null,
                        confirmDepNewValue: null,
                        confirmNewValue: null,
                        confirmAttr: null,
                        confirmData: null,
                    }, () => this.props.onChange(data));
                }
                else {
                    const callback = this.state.confirmCallback;
                    this.setState({
                        confirmDialog: false,
                        confirmDepAttr: null,
                        confirmDepNewValue: null,
                        confirmNewValue: null,
                        confirmAttr: null,
                        confirmData: null,
                        confirmCallback: null,
                    }, () => {
                        if (callback) {
                            callback(false);
                        }
                    });
                }
            }) }));
    }
    // eslint-disable-next-line react/no-unused-class-component-methods
    getIcon(iconSettings) {
        iconSettings = iconSettings || this.props.schema.icon;
        let icon = null;
        if (iconSettings === 'auth') {
            icon = React.createElement(IconAuth, null);
        }
        else if (iconSettings === 'send') {
            icon = React.createElement(IconSend, null);
        }
        else if (iconSettings === 'web') {
            icon = React.createElement(IconWeb, null);
        }
        else if (iconSettings === 'warning') {
            icon = React.createElement(IconWarning, null);
        }
        else if (iconSettings === 'error') {
            icon = React.createElement(IconError, null);
        }
        else if (iconSettings === 'info') {
            icon = React.createElement(IconInfo, null);
        }
        else if (iconSettings === 'search') {
            icon = React.createElement(IconSearch, null);
        }
        else if (iconSettings === 'book') {
            icon = React.createElement(IconMenuBook, null);
        }
        else if (iconSettings === 'help') {
            icon = React.createElement(IconHelp, null);
        }
        else if (iconSettings === 'upload') {
            icon = React.createElement(IconUploadFile, null);
        }
        else if (iconSettings === 'edit') {
            icon = React.createElement(IconEdit, null);
        }
        else if (iconSettings === 'user') {
            icon = React.createElement(IconPerson, null);
        }
        else if (iconSettings === 'group') {
            icon = React.createElement(IconGroup, null);
        }
        else if (iconSettings === 'delete') {
            icon = React.createElement(IconDelete, null);
        }
        else if (iconSettings === 'refresh') {
            icon = React.createElement(IconRefresh, null);
        }
        else if (iconSettings === 'add') {
            icon = React.createElement(IconAdd, null);
        }
        else if (iconSettings === 'unpair') {
            icon = React.createElement(IconLinkOff, null);
        }
        else if (iconSettings === 'pair') {
            icon = React.createElement(LinkIcon, null);
        }
        else if (iconSettings === 'save') {
            icon = React.createElement(Save, null);
        }
        else if (iconSettings === 'open') {
            icon = React.createElement(OpenInNew, null);
        }
        else if (iconSettings) {
            if (iconSettings.endsWith('.png') || iconSettings.endsWith('.svg') || iconSettings.endsWith('.jpg')) {
                // this path is relative to ./adapter/NAME
                if (!iconSettings.startsWith('http://') && !iconSettings.startsWith('https://')) {
                    iconSettings = `./adapter/${this.props.oContext.adapterName}/${iconSettings}`;
                }
            }
            icon = (React.createElement(Icon, { src: iconSettings, style: { width: 22, height: 22 } }));
        }
        return icon;
    }
    /**
     * Trigger onChange, to activate save button on change
     *
     * @param attr the changed attribute
     * @param newValue new value of the attribute
     */
    // eslint-disable-next-line react/no-unused-class-component-methods
    onChangeAsync(attr, newValue) {
        return new Promise(resolve => {
            const mayBePromise = this.onChange(attr, newValue, resolve);
            if (mayBePromise instanceof Promise) {
                mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
            }
        });
    }
    /**
     * Trigger onChange, to activate save button on change
     *
     * @param attr the changed attribute
     * @param newValue new value of the attribute
     * @param cb optional callback function, else returns a Promise
     */
    onChange(attr, newValue, cb) {
        // Do not use here deep copy, as it is not JsonConfig
        const data = JSON.parse(JSON.stringify(this.props.data));
        ConfigGeneric.setValue(data, attr, newValue);
        if (this.props.schema.confirm &&
            this.execute(this.props.schema.confirm.condition, false, data, this.props.arrayIndex, this.props.globalData)) {
            return new Promise(resolve => {
                this.setState({
                    confirmDialog: true,
                    confirmNewValue: newValue,
                    confirmAttr: attr,
                    confirmData: null,
                }, () => {
                    if (typeof cb === 'function') {
                        cb();
                    }
                    else {
                        resolve();
                    }
                });
            });
        }
        // find any inputs with confirmation
        if (this.props.schema.confirmDependsOn) {
            for (let z = 0; z < this.props.schema.confirmDependsOn.length; z++) {
                const dep = this.props.schema.confirmDependsOn[z];
                if (dep.confirm) {
                    const val = ConfigGeneric.getValue(data, dep.attr);
                    if (this.execute(dep.confirm.condition, false, data, this.props.arrayIndex, this.props.globalData)) {
                        return new Promise(resolve => {
                            this.setState({
                                confirmDialog: true,
                                confirmNewValue: newValue,
                                confirmAttr: attr,
                                confirmDepNewValue: val,
                                confirmDepAttr: dep.attr,
                                confirmData: dep.confirm,
                            }, () => {
                                if (typeof cb === 'function') {
                                    cb();
                                }
                                else {
                                    resolve();
                                }
                            });
                        });
                    }
                }
            }
        }
        const changed = [];
        if (this.props.schema.onChangeDependsOn) {
            for (let z = 0; z < this.props.schema.onChangeDependsOn.length; z++) {
                const dep = this.props.schema.onChangeDependsOn[z];
                if (dep.onChange) {
                    const val = ConfigGeneric.getValue(data, dep.attr);
                    let _newValue;
                    if (this.props.custom) {
                        _newValue = this.executeCustom(dep.onChange.calculateFunc, data, this.props.customObj, this.props.oContext.instanceObj, this.props.arrayIndex, this.props.globalData);
                    }
                    else {
                        _newValue = this.execute(dep.onChange.calculateFunc, val, data, this.props.arrayIndex, this.props.globalData);
                    }
                    if (_newValue !== val) {
                        ConfigGeneric.setValue(data, dep.attr, _newValue);
                        changed.push(dep.attr);
                    }
                }
            }
        }
        if (this.props.schema.hiddenDependsOn) {
            for (let z = 0; z < this.props.schema.hiddenDependsOn.length; z++) {
                const dep = this.props.schema.hiddenDependsOn[z];
                if (dep.hidden) {
                    changed.push(dep.attr);
                }
            }
        }
        if (this.props.schema.labelDependsOn) {
            for (let z = 0; z < this.props.schema.labelDependsOn.length; z++) {
                const dep = this.props.schema.labelDependsOn[z];
                if (dep.hidden) {
                    changed.push(dep.attr);
                }
            }
        }
        if (this.props.schema.helpDependsOn) {
            for (let z = 0; z < this.props.schema.helpDependsOn.length; z++) {
                const dep = this.props.schema.helpDependsOn[z];
                if (dep.hidden) {
                    changed.push(dep.attr);
                }
            }
        }
        if (this.props.schema.onChange && !this.props.schema.onChange.ignoreOwnChanges) {
            const val = ConfigGeneric.getValue(data, this.props.attr);
            const newValue_ = this.props.custom
                ? this.executeCustom(this.props.schema.onChange.calculateFunc, data, this.props.customObj, this.props.oContext.instanceObj, this.props.arrayIndex, this.props.globalData)
                : this.execute(this.props.schema.onChange.calculateFunc, val, data, this.props.arrayIndex, this.props.globalData);
            if (newValue_ !== val) {
                ConfigGeneric.setValue(data, this.props.attr, newValue_);
            }
        }
        if (this.props.custom) {
            this.props.onChange(attr, newValue, () => cb && cb());
            if (changed?.length) {
                changed.forEach((_attr, i) => setTimeout(() => this.props.onChange(_attr, ConfigGeneric.getValue(data, _attr)), i * 50));
            }
        }
        else {
            this.props.onChange(data, undefined, () => {
                if (changed.length) {
                    this.props.oContext.forceUpdate(changed, data);
                }
                if (cb) {
                    cb();
                }
            });
        }
        return Promise.resolve();
    }
    execute(func, defaultValue, data, arrayIndex, globalData) {
        let fun;
        if (isObject(func)) {
            fun = func.func;
        }
        else if (typeof func === 'string') {
            fun = func;
        }
        else {
            return func;
        }
        if (!fun) {
            return defaultValue;
        }
        try {
            const f = new Function('data', 'originalData', '_system', '_alive', '_common', '_socket', '_instance', 'arrayIndex', 'globalData', '_changed', fun.includes('return') ? fun : `return ${fun}`);
            return f(data || this.props.data, this.props.originalData, this.props.oContext.systemConfig, this.props.alive, this.props.common, this.props.oContext.socket, this.props.oContext.instance, arrayIndex, globalData, this.props.changed);
        }
        catch (e) {
            console.error(`Cannot execute ${JSON.stringify(func)}: ${e}`);
            return defaultValue;
        }
    }
    executeCustom(func, data, customObj, instanceObj, arrayIndex, globalData) {
        let fun;
        if (isObject(func)) {
            fun = func.func;
        }
        else if (typeof func === 'string') {
            fun = func;
        }
        else {
            return func;
        }
        if (!fun) {
            return null;
        }
        try {
            const f = new Function('data', 'originalData', '_system', 'instanceObj', 'customObj', '_socket', 'arrayIndex', 'globalData', '_changed', fun.includes('return') ? fun : `return ${fun}`);
            return f(data || this.props.data, this.props.originalData, this.props.oContext.systemConfig, instanceObj, customObj, this.props.oContext.socket, arrayIndex, globalData, this.props.changed);
        }
        catch (e) {
            console.error(`Cannot execute ${fun}: ${e}`);
            return null;
        }
    }
    calculate(schema) {
        let error;
        let disabled;
        let hidden;
        let defaultValue;
        if (this.props.custom) {
            error = schema.validator
                ? !this.executeCustom(schema.validator, this.props.data, this.props.customObj, this.props.oContext.instanceObj, this.props.arrayIndex, this.props.globalData)
                : false;
            if (schema.disabled === true) {
                disabled = true;
            }
            else {
                disabled = schema.disabled
                    ? this.executeCustom(schema.disabled, this.props.data, this.props.customObj, this.props.oContext.instanceObj, this.props.arrayIndex, this.props.globalData)
                    : false;
            }
            if (schema.hidden === true) {
                hidden = true;
            }
            else {
                hidden = schema.hidden
                    ? this.executeCustom(schema.hidden, this.props.data, this.props.customObj, this.props.oContext.instanceObj, this.props.arrayIndex, this.props.globalData)
                    : false;
            }
            defaultValue = schema.defaultFunc
                ? this.executeCustom(schema.defaultFunc, this.props.data, this.props.customObj, this.props.oContext.instanceObj, this.props.arrayIndex, this.props.globalData)
                : schema.default;
        }
        else {
            error = schema.validator
                ? !this.execute(schema.validator, false, this.props.data, this.props.arrayIndex, this.props.globalData)
                : false;
            if (schema.disabled === true) {
                disabled = true;
            }
            else {
                disabled = schema.disabled
                    ? this.execute(schema.disabled, false, this.props.data, this.props.arrayIndex, this.props.globalData)
                    : false;
            }
            if (schema.hidden === true) {
                hidden = true;
            }
            else {
                hidden = schema.hidden
                    ? this.execute(schema.hidden, false, this.props.data, this.props.arrayIndex, this.props.globalData)
                    : false;
            }
            defaultValue = schema.defaultFunc
                ? this.execute(schema.defaultFunc, schema.default, this.props.data, this.props.arrayIndex, this.props.globalData)
                : schema.default;
        }
        return {
            error,
            disabled,
            hidden,
            defaultValue,
        };
    }
    onError(attr, error) {
        if (!error) {
            delete this.isError[attr];
        }
        else {
            this.isError[attr] = error;
        }
        if (this.props.onError) {
            this.props.onError(attr, error);
        }
    }
    renderItem(_error, _disabled, _defaultValue) {
        return this.getText(this.props.schema.label) || this.getText(this.props.schema.text);
    }
    // eslint-disable-next-line react/no-unused-class-component-methods
    renderHelp(text, link, noTranslation) {
        if (!link) {
            text = this.getText(text, noTranslation) || '';
            if (text &&
                (text.includes('<a ') || text.includes('<br') || text.includes('<b>') || text.includes('<i>'))) {
                return Utils.renderTextWithA(text);
            }
            return text;
        }
        return (React.createElement("a", { href: link, target: "_blank", rel: "noreferrer", style: {
                color: this.props.oContext.themeType === 'dark' ? '#a147ff' : '#5b238f',
                textDecoration: 'underline',
            } }, this.getText(text, noTranslation)));
    }
    // we have a problem that a string '{"password": "${password}"}' cannot contain a double quota inside the string
    // escape it with \"
    static escapeString(str, data) {
        if (typeof str !== 'string') {
            return '';
        }
        str = str.replace(/`/g, '\\`');
        // extract all tokes with ${data.token}
        str = str.replace(/\${([^}]+)}/g, (_match, p1) => {
            if (p1 && typeof p1 === 'string' && p1.startsWith('data.')) {
                const value = ConfigGeneric.getValue(data, p1.replace(/^data\./, ''));
                if (typeof value === 'string') {
                    // Handle both backslashes and quotes to ensure valid JSON
                    if (value.includes('\\') || value.includes('"')) {
                        return `\${${p1}.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"')}`;
                    }
                }
            }
            return _match;
        });
        return str;
    }
    getPattern(pattern, data, noTranslation) {
        data = data || this.props.data;
        if (!pattern) {
            return '';
        }
        let patternStr;
        if (typeof pattern === 'object') {
            if (pattern.func) {
                patternStr = pattern.func;
            }
            else {
                console.log(`Object must be stringified: ${JSON.stringify(pattern)}`);
                patternStr = JSON.stringify(pattern);
            }
        }
        else {
            patternStr = pattern;
        }
        try {
            if (this.props.custom) {
                const f = new Function('data', 'originalData', 'arrayIndex', 'globalData', '_system', 'instanceObj', 'customObj', '_socket', '_changed', `return \`${ConfigGeneric.escapeString(patternStr, data)}\``);
                return f(data, this.props.originalData, this.props.arrayIndex, this.props.globalData, this.props.oContext.systemConfig, this.props.oContext.instanceObj, this.props.customObj, this.props.oContext.socket, this.props.changed);
            }
            const f = new Function('data', 'originalData', 'arrayIndex', 'globalData', '_system', '_alive', '_common', '_socket', '_changed', `return \`${ConfigGeneric.escapeString(patternStr, data)}\``);
            const text = f(data, this.props.originalData, this.props.arrayIndex, this.props.globalData, this.props.oContext.systemConfig, this.props.alive, this.props.common, this.props.oContext.socket, this.props.changed);
            if (noTranslation) {
                return text;
            }
            return I18n.t(text);
        }
        catch (e) {
            console.error(`Cannot execute ${patternStr}: ${e}`);
            return patternStr;
        }
    }
    render() {
        const schema = this.props.schema;
        if (!schema) {
            return null;
        }
        // Do not show this component if expert mode is false
        if (this.props.expertMode === false && schema.expertMode) {
            return null;
        }
        if (this.props.alive && this.defaultSendToDone === false) {
            this.sendToTimeout = setTimeout(() => {
                this.sendToTimeout = null;
                this.sendTo();
            }, 200);
        }
        const { error, disabled, hidden, defaultValue } = this.calculate(schema);
        if (hidden) {
            // Remove all errors if an element is hidden
            if (Object.keys(this.isError).length) {
                setTimeout(isError => Object.keys(isError).forEach(attr => this.props.onError(attr)), 100, JSON.parse(JSON.stringify(this.isError)));
                this.isError = {};
            }
            if (schema.hideOnlyControl) {
                const item = (React.createElement(Grid2, { size: {
                        xs: schema.xs || DEFAULT_SM_SIZE, // if xs is not defined, take the full width
                        sm: schema.sm || undefined,
                        md: schema.md || undefined,
                        lg: schema.lg || undefined,
                        xl: schema.xl || undefined,
                    }, style: {
                        marginBottom: 0 /* marginRight: 8, */,
                        textAlign: 'left',
                        ...schema.style,
                        ...(this.props.oContext.themeType === 'dark' ? schema.darkStyle : {}),
                    } }));
                if (schema.newLine) {
                    return (React.createElement(React.Fragment, null,
                        React.createElement("div", { style: { flexBasis: '100%', height: 0 } }),
                        item));
                }
                return item;
            }
            return null;
        }
        // Add error
        if (schema.validatorNoSaveOnError) {
            if (error && !Object.keys(this.isError).length) {
                this.isError = {
                    [this.props.attr]: schema.validatorErrorText ? I18n.t(schema.validatorErrorText) : true,
                };
                setTimeout(isError => Object.keys(isError).forEach(attr => this.props.onError(attr, isError[attr])), 100, JSON.parse(JSON.stringify(this.isError)));
            }
            else if (!error && Object.keys(this.isError).length) {
                setTimeout(isError => Object.keys(isError).forEach(attr => this.props.onError(attr)), 100, JSON.parse(JSON.stringify(this.isError)));
                this.isError = {};
            }
        }
        const renderedItem = this.renderItem(error, disabled || this.props.commandRunning || this.props.disabled, defaultValue);
        if (this.noPlaceRequired) {
            return renderedItem;
        }
        const item = (React.createElement(Grid2, { title: this.getText(schema.tooltip), size: {
                xs: schema.xs || 12, // if xs is not defined, take the full width
                sm: schema.sm || undefined,
                md: schema.md || undefined,
                lg: schema.lg || undefined,
                xl: schema.xl || undefined,
            }, style: {
                marginBottom: 0,
                textAlign: 'left',
                width: schema.type === 'divider' || schema.type === 'header' ? schema.width || '100%' : undefined,
                ...schema.style,
                ...(this.props.oContext.themeType === 'dark' ? schema.darkStyle : {}),
            } }, this.props.schema.defaultSendTo && this.props.schema.button ? (React.createElement(Grid2, { container: true, style: { width: '100%' } },
            React.createElement(Grid2, { flex: 1 }, renderedItem),
            React.createElement(Grid2, null,
                React.createElement(Button, { disabled: disabled, variant: "outlined", onClick: () => this.sendTo(), title: this.props.schema.buttonTooltip
                        ? this.getText(this.props.schema.buttonTooltip, this.props.schema.buttonTooltipNoTranslation)
                        : I18n.t('ra_Request data by instance') }, this.getText(this.props.schema.button))))) : (renderedItem)));
        if (schema.newLine) {
            return (React.createElement(React.Fragment, null,
                React.createElement("div", { style: { flexBasis: '100%', height: 0 } }),
                this.renderDialogConfirm(),
                item));
        }
        if (this.state.confirmDialog) {
            return (React.createElement(React.Fragment, null,
                this.renderDialogConfirm(),
                item));
        }
        return item;
    }
}
//# sourceMappingURL=ConfigGeneric.js.map