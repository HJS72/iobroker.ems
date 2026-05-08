import React from 'react';
import { FormHelperText, Accordion, AccordionSummary, AccordionDetails, IconButton, Paper, Toolbar, Tooltip, Typography, Box, } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, ArrowUpward as UpIcon, ArrowDownward as DownIcon, ContentCopy as CopyContentIcon, ExpandMore as ExpandMoreIcon, Error as ErrorIcon, FileDownload as FileDownloadIcon, FileUpload as FileUploadIcon, AddCircle as AddCircleIcon, } from '@mui/icons-material';
import { I18n, Utils } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
import ConfigPanel from './ConfigPanel';
const styles = {
    fullWidth: {
        width: '100%',
    },
    accordionSummary: (theme) => ({
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    }),
    accordionTitle: {
    // fontWeight: 'bold',
    },
    toolbar: (theme) => ({
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        borderRadius: '3px',
    }),
    tooltip: {
        pointerEvents: 'none',
    },
};
class ConfigAccordion extends ConfigGeneric {
    typingTimer = null;
    constructor(props) {
        super(props);
        this.props.schema.items = this.props.schema.items || [];
    }
    componentDidMount() {
        super.componentDidMount();
        let value = ConfigGeneric.getValue(this.props.data, this.props.attr) || [];
        if (!Array.isArray(value)) {
            value = [];
        }
        this.setState({
            value,
            activeIndex: -1,
            iteration: 0,
            accordionErrors: {},
        });
    }
    componentWillUnmount() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        super.componentWillUnmount();
    }
    onAccordionError = (accordionIndex) => (attr, error) => {
        const newAccordionErrors = { ...this.state.accordionErrors };
        if (!newAccordionErrors[accordionIndex]) {
            newAccordionErrors[accordionIndex] = {};
        }
        if (!error) {
            delete newAccordionErrors[accordionIndex][attr];
            // Clean up empty accordion error objects
            if (Object.keys(newAccordionErrors[accordionIndex]).length === 0) {
                delete newAccordionErrors[accordionIndex];
            }
        }
        else {
            newAccordionErrors[accordionIndex][attr] = error;
        }
        this.setState({ accordionErrors: newAccordionErrors });
        // Also forward to parent
        this.props.onError(attr, error);
    };
    hasAccordionErrors = (accordionIndex) => {
        return !!(this.state.accordionErrors[accordionIndex] &&
            Object.keys(this.state.accordionErrors[accordionIndex]).length > 0);
    };
    itemAccordion(data, idx) {
        const { value } = this.state;
        const { schema } = this.props;
        const schemaItem = {
            type: 'panel',
            items: schema.items.reduce((accumulator, currentValue) => {
                accumulator[currentValue.attr] = currentValue;
                return accumulator;
            }, {}),
            style: { marginLeft: '-8px', marginTop: '10px', marginBottom: '10px' },
        };
        return (React.createElement(ConfigPanel, { oContext: this.props.oContext, index: idx + this.state.iteration, arrayIndex: idx, changed: this.props.changed, expertMode: this.props.expertMode, globalData: this.props.data, common: this.props.common, alive: this.props.alive, themeName: this.props.themeName, data: data, custom: true, schema: schemaItem, originalData: this.props.originalData, onChange: (attr, valueChange) => {
                const newObj = JSON.parse(JSON.stringify(value));
                newObj[idx][attr] = valueChange;
                this.setState({ value: newObj }, () => this.onChangeWrapper(newObj));
            }, onError: this.onAccordionError(idx), table: this.props.table }));
    }
    onDelete = (index) => () => {
        const newValue = JSON.parse(JSON.stringify(this.state.value));
        newValue.splice(index, 1);
        this.setState({ value: newValue, iteration: this.state.iteration + 10000 }, () => this.onChangeWrapper(newValue));
    };
    onClone = (index) => () => {
        const newValue = JSON.parse(JSON.stringify(this.state.value));
        const cloned = JSON.parse(JSON.stringify(newValue[index]));
        if (typeof this.props.schema.clone === 'string' && typeof cloned[this.props.schema.clone] === 'string') {
            let i = 1;
            let text = cloned[this.props.schema.clone];
            const pattern = text.match(/(\d+)$/);
            if (pattern) {
                text = text.replace(pattern[0], '');
                i = parseInt(pattern[0], 10) + 1;
            }
            else {
                text += '_';
            }
            while (newValue.find(it => it[this.props.schema.clone] === text + i.toString())) {
                i++;
            }
            cloned[this.props.schema.clone] = `${cloned[this.props.schema.clone]}_${i}`;
        }
        newValue.splice(index, 0, cloned);
        this.setState({
            value: newValue,
            activeIndex: -1,
            iteration: this.state.iteration + 10000,
        }, () => this.onChangeWrapper(newValue));
    };
    onChangeWrapper = (newValue) => {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }
        this.typingTimer = setTimeout(value => {
            this.typingTimer = null;
            const mayByPromise = this.onChange(this.props.attr, value);
            if (mayByPromise instanceof Promise) {
                void mayByPromise.catch(e => this.onError(e));
            }
        }, 300, newValue);
    };
    onAdd = () => {
        const { schema } = this.props;
        const newValue = JSON.parse(JSON.stringify(this.state.value));
        const newItem = schema.items &&
            schema.items.reduce((accumulator, currentValue) => {
                let defaultValue;
                if (currentValue.defaultFunc) {
                    if (this.props.custom) {
                        defaultValue = currentValue.defaultFunc
                            ? this.executeCustom(currentValue.defaultFunc, this.props.data, this.props.customObj, this.props.oContext.instanceObj, newValue.length, this.props.data)
                            : this.props.schema.default;
                    }
                    else {
                        defaultValue = currentValue.defaultFunc
                            ? this.execute(currentValue.defaultFunc, this.props.schema.default, this.props.data, newValue.length, this.props.data)
                            : this.props.schema.default;
                    }
                }
                else {
                    defaultValue = currentValue.default === undefined ? null : currentValue.default;
                }
                accumulator[currentValue.attr] = defaultValue;
                return accumulator;
            }, {});
        newValue.push(newItem);
        this.setState({ value: newValue, activeIndex: newValue.length - 1 }, () => this.onChangeWrapper(newValue));
    };
    onMoveUp(idx) {
        const newValue = JSON.parse(JSON.stringify(this.state.value));
        const item = newValue[idx];
        newValue.splice(idx, 1);
        newValue.splice(idx - 1, 0, item);
        const newIndex = this.state.activeIndex - 1;
        this.setState({ value: newValue, activeIndex: newIndex, iteration: this.state.iteration + 10000 }, () => this.onChangeWrapper(newValue));
    }
    onMoveDown(idx) {
        const newValue = JSON.parse(JSON.stringify(this.state.value));
        const item = newValue[idx];
        newValue.splice(idx, 1);
        newValue.splice(idx + 1, 0, item);
        const newIndex = this.state.activeIndex + 1;
        this.setState({ value: newValue, activeIndex: newIndex, iteration: this.state.iteration + 10000 }, () => this.onChangeWrapper(newValue));
    }
    onExport = () => {
        const { value } = this.state;
        const dataStr = JSON.stringify(value, null, 2);
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
        const exportFileDefaultName = `config_section_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };
    onImport = (replace) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const jsonData = JSON.parse(e.target?.result);
                    if (!Array.isArray(jsonData)) {
                        alert(I18n.t('ra_Invalid JSON format. Expected an array.'));
                        return;
                    }
                    let newValue;
                    if (replace) {
                        newValue = jsonData;
                    }
                    else {
                        newValue = [...this.state.value, ...jsonData];
                    }
                    this.setState({ value: newValue, activeIndex: -1 }, () => this.onChangeWrapper(newValue));
                }
                catch {
                    alert(I18n.t('ra_Invalid JSON file.'));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };
    renderItem( /* error, disabled, defaultValue */) {
        const { schema } = this.props;
        const { value } = this.state;
        if (!value) {
            return null;
        }
        return (React.createElement(Paper, null,
            schema.label || !schema.noDelete ? (React.createElement(Toolbar, { variant: "dense" },
                schema.label ? (React.createElement(Typography, { variant: "h6", id: "tableTitle", component: "div" }, this.getText(schema.label))) : null,
                !schema.noDelete ? (React.createElement(React.Fragment, null,
                    React.createElement(Tooltip, { title: I18n.t('ra_Export configuration section') },
                        React.createElement(IconButton, { size: "small", color: "primary", onClick: this.onExport },
                            React.createElement(FileDownloadIcon, null))),
                    React.createElement(Tooltip, { title: I18n.t('ra_Import and replace configuration section') },
                        React.createElement(IconButton, { size: "small", color: "primary", onClick: () => this.onImport(true) },
                            React.createElement(FileUploadIcon, null))),
                    React.createElement(Tooltip, { title: I18n.t('ra_Import and add configuration section') },
                        React.createElement(IconButton, { size: "small", color: "primary", onClick: () => this.onImport(false) },
                            React.createElement(AddCircleIcon, null))),
                    React.createElement(IconButton, { size: "small", color: "primary", onClick: this.onAdd },
                        React.createElement(AddIcon, null)))) : null)) : null,
            value.map((idx, i) => (React.createElement(Accordion, { key: `${idx}_${i}`, expanded: this.state.activeIndex === i, onChange: (_e, expanded) => this.setState({ activeIndex: expanded ? i : -1 }) },
                React.createElement(AccordionSummary, { expandIcon: React.createElement(ExpandMoreIcon, null), sx: Utils.getStyle(this.props.oContext.theme, styles.fullWidth, styles.accordionSummary) },
                    React.createElement(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1, width: '100%' } },
                        React.createElement(Typography, { style: styles.accordionTitle }, idx[schema.titleAttr]),
                        this.hasAccordionErrors(i) && React.createElement(ErrorIcon, { sx: { fontSize: 20, color: 'error.main' } }))),
                React.createElement(AccordionDetails, { style: {
                        ...schema.style,
                        ...(this.props.oContext.themeType ? schema.darkStyle : undefined),
                    } },
                    this.itemAccordion(value[i], i),
                    React.createElement(Toolbar, { sx: styles.toolbar },
                        i ? (React.createElement(Tooltip, { title: I18n.t('ra_Move up'), slotProps: { popper: { sx: styles.tooltip } } },
                            React.createElement(IconButton, { size: "small", onClick: () => this.onMoveUp(i) },
                                React.createElement(UpIcon, null)))) : (React.createElement("div", { style: styles.buttonEmpty })),
                        i < value.length - 1 ? (React.createElement(Tooltip, { title: I18n.t('ra_Move down'), slotProps: { popper: { sx: styles.tooltip } } },
                            React.createElement(IconButton, { size: "small", onClick: () => this.onMoveDown(i) },
                                React.createElement(DownIcon, null)))) : (React.createElement("div", { style: styles.buttonEmpty })),
                        !schema.noDelete ? (React.createElement(Tooltip, { title: I18n.t('ra_Delete current row'), slotProps: { popper: { sx: styles.tooltip } } },
                            React.createElement(IconButton, { size: "small", onClick: this.onDelete(i) },
                                React.createElement(DeleteIcon, null)))) : null,
                        schema.clone ? (React.createElement(Tooltip, { title: I18n.t('ra_Clone current row'), slotProps: { popper: { sx: styles.tooltip } } },
                            React.createElement(IconButton, { size: "small", onClick: this.onClone(i) },
                                React.createElement(CopyContentIcon, null)))) : null))))),
            !schema.noDelete && value.length > 0 ? (React.createElement(Toolbar, { variant: "dense", sx: styles.rootTool },
                React.createElement(IconButton, { size: "small", color: "primary", onClick: this.onAdd },
                    React.createElement(AddIcon, null)))) : null,
            schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigAccordion;
//# sourceMappingURL=ConfigAccordion.js.map