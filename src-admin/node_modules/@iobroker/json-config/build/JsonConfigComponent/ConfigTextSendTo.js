import React from 'react';
import { TextField, IconButton } from '@mui/material';
import { I18n, Icon, IconCopy, Utils } from '@iobroker/adapter-react-v5';
import getIconByName from './Icons';
import ConfigGeneric from './ConfigGeneric';
const styles = {
    fullWidth: {
        width: '100%',
    },
};
class ConfigTextSendTo extends ConfigGeneric {
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
            void this.props.oContext.socket
                .sendTo(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, this.props.schema.command || 'send', data)
                .then(result => {
                if (typeof result === 'object') {
                    const _data = result;
                    this.setState({
                        text: _data.text || '',
                        style: _data.style,
                        icon: _data.icon,
                        iconStyle: _data.iconStyle,
                    });
                }
                else if (typeof result === 'string') {
                    this.setState({ text: result || '' });
                }
            })
                .catch(e => console.error(`Cannot send command: ${e}`));
        }
    }
    getLocalContext() {
        const localContext = {};
        if (Array.isArray(this.props.schema.alsoDependsOn)) {
            this.props.schema.alsoDependsOn.forEach(attr => (localContext[attr] = ConfigGeneric.getValue(this.props.data, attr)));
        }
        return JSON.stringify(localContext);
    }
    renderItem( /* error, disabled, defaultValue */) {
        if (this.props.alive) {
            const localContext = this.getLocalContext();
            if (localContext !== this.localContext || !this.initialized) {
                this.localContext = localContext;
                setTimeout(() => this.askInstance(), this.initialized ? 300 : 50);
                this.initialized = true;
            }
        }
        if (this.state.text === undefined) {
            return null;
        }
        let icon = null;
        if (this.state.icon) {
            icon = getIconByName(this.state.icon, {
                marginRight: this.state.text ? 8 : undefined,
                ...(this.state.iconStyle || undefined),
            });
            if (!icon) {
                icon = (React.createElement(Icon, { src: this.state.icon, style: { marginRight: this.state.text ? 8 : undefined, ...(this.state.iconStyle || undefined) } }));
            }
        }
        if (this.props.schema.container === 'text') {
            return (React.createElement(TextField, { variant: "standard", fullWidth: true, slotProps: {
                    input: {
                        endAdornment: this.props.schema.copyToClipboard ? (React.createElement(IconButton, { tabIndex: -1, size: "small", onClick: () => {
                                Utils.copyToClipboard(this.state.text);
                                window.alert(I18n.t('ra_Copied'));
                            } },
                            React.createElement(IconCopy, null))) : undefined,
                    },
                }, value: this.state.text, label: this.getText(this.props.schema.label), helperText: this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation) }));
        }
        return (React.createElement("div", { style: { ...styles.fullWidth, ...(this.state.style || undefined) } },
            icon,
            this.props.schema.container === 'html' ? (React.createElement("span", { dangerouslySetInnerHTML: { __html: this.state.text || '' } })) : (this.state.text)));
    }
}
export default ConfigTextSendTo;
//# sourceMappingURL=ConfigTextSendTo.js.map