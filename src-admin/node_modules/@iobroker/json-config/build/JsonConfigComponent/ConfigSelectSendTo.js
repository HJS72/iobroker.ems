import React from 'react';
import { InputLabel, MenuItem, FormHelperText, FormControl, Select, TextField, CircularProgress, ListItemText, Checkbox, Chip, Box, InputAdornment, IconButton, ListSubheader, } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
const styles = {
    menuPaper: {
        maxHeight: 800,
    },
};
class ConfigSelectSendTo extends ConfigGeneric {
    initialized = false;
    localContext;
    askInstance() {
        if (this.props.alive) {
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
            if (data === undefined) {
                data = null;
            }
            this.setState({ running: true }, () => {
                void this.props.oContext.socket
                    .sendTo(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, this.props.schema.command || 'send', data)
                    .then(list => this.setState({ list, running: false }))
                    .catch(e => {
                    console.error(`Cannot send command: ${e}`);
                });
            });
        }
        else {
            const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
            this.setState({ value, running: false });
        }
    }
    getContext() {
        const localContext = {};
        if (Array.isArray(this.props.schema.alsoDependsOn)) {
            this.props.schema.alsoDependsOn.forEach(attr => (localContext[attr] = ConfigGeneric.getValue(this.props.data, attr)));
        }
        return JSON.stringify(localContext);
    }
    _getValue() {
        let value = this.state.value === null || this.state.value === undefined
            ? ConfigGeneric.getValue(this.props.data, this.props.attr)
            : this.state.value;
        if (this.props.schema.multiple) {
            if (typeof value === 'string') {
                value = [value];
            }
            else if (value === null || value === undefined) {
                value = [];
            }
        }
        return value;
    }
    renderItem(error, disabled /* , defaultValue */) {
        if (this.props.alive) {
            const localContext = this.getContext();
            if (localContext !== this.localContext || !this.initialized) {
                this.localContext = localContext;
                setTimeout(() => this.askInstance(), this.initialized ? 300 : 50);
                this.initialized = true;
            }
        }
        const value = this._getValue();
        if (!this.props.alive || (!this.state.running && !Array.isArray(this.state.list))) {
            if (this.props.schema.multiple || this.props.schema.manual === false) {
                return I18n.t('ra_Cannot retrieve options, as instance is offline');
            }
            return (React.createElement(TextField, { variant: "standard", fullWidth: true, value: value, error: !!error, disabled: !!disabled, onChange: e => {
                    const value_ = e.target.value;
                    this.setState({ value: value_ }, () => this.onChange(this.props.attr, (value_ || '').trim()));
                }, placeholder: this.getText(this.props.schema.placeholder), label: this.getText(this.props.schema.label), helperText: this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation), slotProps: {
                    input: {
                        endAdornment: this.state.value && !this.props.schema.noClearButton ? (React.createElement(InputAdornment, { position: "end" },
                            React.createElement(IconButton, { tabIndex: -1, size: "small", onClick: () => this.setState({ value: '' }, () => this.onChange(this.props.attr, '')) },
                                React.createElement(CloseIcon, null)))) : null,
                    },
                } }));
        }
        if (this.state.running) {
            return React.createElement(CircularProgress, { size: "24" });
        }
        const selectOptions = this.state.list.filter(item => {
            if (!item.hidden) {
                return true;
            }
            if (this.props.custom) {
                return !this.executeCustom(item.hidden, this.props.data, this.props.customObj, this.props.oContext.instanceObj, this.props.arrayIndex, this.props.globalData);
            }
            return !this.execute(item.hidden, this.props.schema.default, this.props.data, this.props.arrayIndex, this.props.globalData);
        });
        const item = selectOptions.find(it => it.value === value);
        return (React.createElement(FormControl, { variant: "standard", fullWidth: true },
            this.props.schema.label ? React.createElement(InputLabel, null, this.getText(this.props.schema.label)) : null,
            React.createElement(Select, { variant: "standard", error: !!error, multiple: this.props.schema.multiple, disabled: !!disabled, 
                // MenuProps={this.props.schema.multiple ? { classes: { paper: this.props.classes.menuPaper } } : undefined}
                sx: {
                    '&.MuiSelect-paper': this.props.schema.multiple ? styles.menuPaper : undefined,
                }, value: value, renderValue: (val) => this.props.schema.multiple ? (React.createElement(Box, { sx: { display: 'flex', flexWrap: 'wrap', gap: 0.5 } }, val.map((v) => {
                    const it = selectOptions.find(_item => _item.value === v);
                    if (it || this.props.schema.showAllValues !== false) {
                        const label = it?.label || v;
                        return (React.createElement(Chip, { key: v, label: label }));
                    }
                    return null;
                }))) : (this.getText(item?.label || val, this.props.schema.noTranslation)), onChange: e => {
                    const mayBePromise = this.onChange(this.props.attr, e.target.value);
                    if (mayBePromise instanceof Promise) {
                        mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                    }
                } }, selectOptions.map((it, i) => {
                if (it.group) {
                    return (React.createElement(ListSubheader, { key: i }, this.getText(it.label, this.props.schema.noTranslation)));
                }
                return (React.createElement(MenuItem, { key: i, value: it.value },
                    this.props.schema.multiple ? (React.createElement(Checkbox, { checked: value.includes(it.value), onClick: () => {
                            const _value = JSON.parse(JSON.stringify(this._getValue()));
                            const pos = value.indexOf(it.value);
                            if (pos !== -1) {
                                _value.splice(pos, 1);
                            }
                            else {
                                _value.push(it.value);
                                _value.sort();
                            }
                            this.setState({ value: _value }, () => this.onChange(this.props.attr, _value));
                        } })) : null,
                    React.createElement(ListItemText, { primary: it.label })));
            })),
            this.props.schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigSelectSendTo;
//# sourceMappingURL=ConfigSelectSendTo.js.map