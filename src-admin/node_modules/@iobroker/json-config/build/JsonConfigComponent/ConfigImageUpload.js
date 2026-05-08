import React from 'react';
import { InputLabel, FormHelperText, FormControl } from '@mui/material';
import { UploadImage } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
class ConfigImageUpload extends ConfigGeneric {
    index;
    constructor(props) {
        super(props);
        this.index = Date.now();
    }
    componentDidMount() {
        super.componentDidMount();
        if (this.props.schema.base64) {
            const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
            this.setState({ value });
        }
        else {
            void this.props.oContext.socket
                .fileExists(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, this.props.attr)
                .then(exist => exist && this.loadImage());
        }
    }
    _getUrl(update) {
        if (update) {
            this.index = Date.now();
        }
        let url = `files/${this.props.oContext.adapterName}.${this.props.oContext.instance}/${this.props.attr}?t=${this.index}`;
        if (window.location.port === '3000') {
            url = `${window.location.protocol}//${window.location.hostname}:8081/${url}`;
        }
        return url;
    }
    loadImage() {
        void fetch(this._getUrl())
            .then(res => res.blob())
            .then(blob => {
            const reader = new FileReader();
            reader.onload = () => {
                this.setState({ value: reader.result });
            };
            reader.readAsDataURL(blob);
        })
            .catch(e => console.error(e));
    }
    renderItem(error, disabled /* , defaultValue */) {
        return (React.createElement(FormControl, { fullWidth: true, variant: "standard" },
            this.props.schema.label ? (React.createElement(InputLabel, { shrink: true }, this.getText(this.props.schema.label))) : null,
            React.createElement(UploadImage, { error: !!error, disabled: disabled, accept: this.props.schema.accept, crop: this.props.schema.crop, maxSize: this.props.schema.maxSize || 256 * 1024, icon: this.state.value || undefined, removeIconFunc: () => this.setState({ value: null }, () => {
                    if (this.props.schema.base64) {
                        const mayBePromise = this.onChange(this.props.attr, this.state.value);
                        if (mayBePromise instanceof Promise) {
                            void mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                        }
                    }
                    else {
                        // delete file to /instance/attr
                        void this.props.oContext.socket
                            .deleteFile(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, this.props.attr)
                            .catch(e => console.error(e));
                    }
                }), onChange: base64 => this.setState({ value: base64 }, () => {
                    if (this.props.schema.base64) {
                        const mayBePromise = this.onChange(this.props.attr, this.state.value);
                        if (mayBePromise instanceof Promise) {
                            void mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                        }
                    }
                    else if (base64.startsWith('data')) {
                        base64 = base64.split(',')[1];
                    }
                    // upload file to /instance/attr
                    this.props.oContext.socket
                        .writeFile64(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, this.props.attr, base64)
                        .catch(e => console.error(e));
                }) }),
            this.props.schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigImageUpload;
//# sourceMappingURL=ConfigImageUpload.js.map