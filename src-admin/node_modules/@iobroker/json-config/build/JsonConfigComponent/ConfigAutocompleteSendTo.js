import React from 'react';
import { Autocomplete, TextField, CircularProgress, InputAdornment } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
class ConfigAutocompleteSendTo extends ConfigGeneric {
    initialized = false;
    localContext;
    askInstance() {
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        const selectOptions = this.props.schema.options
            ? this.props.schema.options.map((item) => typeof item === 'string' ? { label: item, value: item } : JSON.parse(JSON.stringify(item)))
            : [];
        if (this.props.alive) {
            let data = this.props.schema.data;
            if (data === undefined && this.props.schema.jsonData) {
                const dataStr = this.getPattern(this.props.schema.jsonData, null, true);
                try {
                    if (typeof dataStr === 'string') {
                        data = JSON.parse(dataStr);
                    }
                }
                catch {
                    console.error(`Cannot parse json data: ${JSON.stringify(data)}`);
                }
            }
            if (data === undefined) {
                data = null;
            }
            // Set loading state during sendTo request
            this.setState({ loading: true });
            void this.props.oContext.socket
                .sendTo(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, this.props.schema.command || 'send', data)
                .then((list) => {
                if (list && Array.isArray(list)) {
                    list.forEach(item => selectOptions.push(typeof item === 'string'
                        ? { label: item, value: item }
                        : JSON.parse(JSON.stringify(item))));
                }
                // if __different
                if (Array.isArray(value)) {
                    selectOptions.unshift({
                        label: I18n.t(ConfigGeneric.DIFFERENT_LABEL),
                        value: ConfigGeneric.DIFFERENT_VALUE,
                    });
                    this.setState({ value: ConfigGeneric.DIFFERENT_VALUE, selectOptions, loading: false });
                }
                else {
                    this.setState({ value, selectOptions, loading: false });
                }
            })
                .catch(error => {
                console.error('Error in autocompleteSendTo:', error);
                // Clear loading state on error
                this.setState({ loading: false });
            });
        }
        else if (Array.isArray(value)) {
            // if __different
            selectOptions.unshift({
                label: I18n.t(ConfigGeneric.DIFFERENT_LABEL),
                value: ConfigGeneric.DIFFERENT_VALUE,
            });
            this.setState({ value: ConfigGeneric.DIFFERENT_VALUE, selectOptions });
        }
        else {
            this.setState({ value, selectOptions });
        }
    }
    getContext() {
        const localContext = {};
        if (Array.isArray(this.props.schema.alsoDependsOn)) {
            this.props.schema.alsoDependsOn.forEach(attr => (localContext[attr] = ConfigGeneric.getValue(this.props.data, attr)));
        }
        return JSON.stringify(localContext);
    }
    renderItem(error, disabled) {
        if (this.props.alive) {
            const localContext = this.getContext();
            if (localContext !== this.localContext || !this.initialized) {
                this.localContext = localContext;
                setTimeout(() => this.askInstance(), this.initialized ? 300 : 50);
                this.initialized = true;
            }
        }
        let item;
        const options = this.state.selectOptions
            ? JSON.parse(JSON.stringify(this.state.selectOptions))
            : [];
        const isIndeterminate = Array.isArray(this.state.value) || this.state.value === ConfigGeneric.DIFFERENT_LABEL;
        if (isIndeterminate) {
            [...this.state.value]
                .filter(val => !options.find((it) => it.value === val))
                .forEach(it => options.push({ label: it.toString(), value: it }));
            item = { label: I18n.t(ConfigGeneric.DIFFERENT_LABEL), value: ConfigGeneric.DIFFERENT_VALUE };
            options.unshift(item);
        }
        else {
            item =
                this.state.value !== null &&
                    this.state.value !== undefined &&
                    options.find((item) => item.value == this.state.value); // let "==" be and not ===
            if (this.state.value !== null && this.state.value !== undefined && !item && this.props.schema.freeSolo) {
                item = { value: this.state.value, label: this.state.value };
                options.push(item);
            }
            item = item || null;
        }
        if (!options.length) {
            return (React.createElement(TextField, { variant: "standard", fullWidth: true, value: this.state.value === null || this.state.value === undefined ? '' : this.state.value, error: !!error, disabled: disabled, inputProps: {
                    maxLength: this.props.schema.maxLength || this.props.schema.max || undefined,
                }, InputProps: this.state.loading
                    ? {
                        endAdornment: (React.createElement(InputAdornment, { position: "end" },
                            React.createElement(CircularProgress, { size: 20 }))),
                    }
                    : undefined, onChange: e => {
                    const value = e.target.value;
                    this.setState({ value }, () => this.onChange(this.props.attr, (value || '').trim()));
                }, placeholder: this.getText(this.props.schema.placeholder), label: this.getText(this.props.schema.label), helperText: this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation) }));
        }
        return (React.createElement(Autocomplete, { value: item, fullWidth: true, freeSolo: !!this.props.schema.freeSolo, options: options, isOptionEqualToValue: (option, value) => option.value === value.value, filterOptions: (options, params) => {
                const filtered = options.filter(option => {
                    if (params.inputValue === '') {
                        return true;
                    }
                    return (option.label.toLowerCase().includes(params.inputValue.toLowerCase()) ||
                        option.value.toLowerCase().includes(params.inputValue.toLowerCase()));
                });
                if (this.props.schema.freeSolo && params.inputValue !== '') {
                    filtered.push({
                        label: params.inputValue,
                        value: params.inputValue,
                    });
                }
                return filtered;
            }, getOptionLabel: (option) => option?.label ?? '', onInputChange: e => {
                if (!e || !this.props.schema.freeSolo) {
                    return;
                }
                const val = e.target.value;
                if (val !== this.state.value) {
                    this.setState({ value: val }, () => this.onChange(this.props.attr, val));
                }
            }, onChange: (_, value) => {
                const val = typeof value === 'object' ? (value ? value.value : '') : value;
                if (val !== this.state.value) {
                    this.setState({ value: val }, () => this.onChange(this.props.attr, val));
                }
            }, renderInput: params => (React.createElement(TextField, { variant: "standard", ...params, 
                // inputProps are important and will be given in params
                // inputProps={{maxLength: this.props.schema.maxLength || this.props.schema.max || undefined}}
                error: !!error, placeholder: this.getText(this.props.schema.placeholder), label: this.getText(this.props.schema.label), helperText: this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation), disabled: disabled, InputProps: {
                    ...params.InputProps,
                    endAdornment: (React.createElement(React.Fragment, null,
                        this.state.loading ? (React.createElement(InputAdornment, { position: "end" },
                            React.createElement(CircularProgress, { size: 20 }))) : null,
                        params.InputProps.endAdornment)),
                } })) }));
    }
}
export default ConfigAutocompleteSendTo;
//# sourceMappingURL=ConfigAutocompleteSendTo.js.map