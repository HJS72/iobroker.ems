import React from 'react';
import { Box, Button } from '@mui/material';
import { Utils } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
const styles = {
    fullWidth: {
        height: '100%',
        width: '100%',
    },
    link: (theme) => ({
        textDecoration: 'underline',
        color: theme.palette.mode === 'dark' ? '#4dabf5' : '#254e72',
        cursor: 'pointer',
    }),
};
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
function onLink(href, target, instanceId) {
    let _target;
    let url = '';
    if (!href) {
        url = `#tab-instances/config/${instanceId}`;
        _target = target || '_self';
    }
    else if (href.toString().startsWith('#')) {
        _target = target || '_self';
        url = href;
    }
    else if (href.toString().startsWith('/')) {
        _target = target || '_self';
        url = href;
    }
    else if (href.startsWith('http://') || href.startsWith('https://')) {
        _target = target || '_blank';
        url = href;
    }
    else {
        url = `#tab-instances/config/${instanceId}/${href}`;
        _target = target || '_self';
    }
    if (_target === '_self') {
        // close dialog
        setTimeout((_url) => {
            if (_url.startsWith('#')) {
                window.location.hash = _url;
            }
            else if (_url.startsWith('/')) {
                url = `${window.location.protocol}:${window.location.host}${url}`;
            }
            else if (_url.startsWith('http://') || _url.startsWith('https://')) {
                window.location.href = _url;
            }
        }, 100, url);
    }
    else {
        if (url.startsWith('#')) {
            url = `${window.location.protocol}:${window.location.host}${window.location.pathname}${url}`;
        }
        else if (url.startsWith('/')) {
            url = `${window.location.protocol}:${window.location.host}${url}`;
        }
        window.open(url, _target);
    }
}
class ConfigStaticText extends ConfigGeneric {
    renderItem(_error, disabled /* , defaultValue */) {
        if (this.props.schema.button) {
            const icon = this.getIcon();
            return (React.createElement(Button, { variant: this.props.schema.variant || undefined, color: this.props.schema.color || 'grey', style: { ...styles.fullWidth, ...(this.props.schema.controlStyle || undefined) }, disabled: disabled, startIcon: icon, onClick: this.props.schema.href
                    ? () => {
                        // calculate one more time just before call
                        const href = this.props.schema.href
                            ? this.getText(this.props.schema.href, true)
                            : null;
                        if (href) {
                            if (this.props.oContext.onBackEndCommand) {
                                this.props.oContext.onBackEndCommand({
                                    command: 'link',
                                    url: href,
                                    target: this.props.schema.target,
                                    close: this.props.schema.close,
                                });
                            }
                            else {
                                onLink(href, this.props.schema.target, `${this.props.oContext.adapterName}.${this.props.oContext.instance}`);
                            }
                        }
                    }
                    : null }, this.getText(this.props.schema.text || this.props.schema.label, this.props.schema.noTranslation)));
        }
        let text = this.getText(this.props.schema.text || this.props.schema.label, this.props.schema.noTranslation);
        if (text && (text.includes('<a ') || text.includes('<br') || text.includes('<b>') || text.includes('<i>'))) {
            text = Utils.renderTextWithA(text);
        }
        return (React.createElement(Box, { component: "span", style: { ...(this.props.schema.controlStyle || undefined) }, sx: this.props.schema.href ? styles.link : undefined, onClick: this.props.schema.href
                ? () => {
                    // calculate one more time just before call
                    const href = this.props.schema.href ? this.getText(this.props.schema.href, true) : null;
                    if (href) {
                        if (this.props.oContext.onBackEndCommand) {
                            this.props.oContext.onBackEndCommand({
                                command: 'link',
                                url: href,
                                target: this.props.schema.target || '_blank',
                                close: this.props.schema.close,
                            });
                        }
                        else {
                            onLink(href, this.props.schema.target || '_blank', `${this.props.oContext.adapterName}.${this.props.oContext.instance}`);
                        }
                    }
                }
                : null }, text));
    }
}
export default ConfigStaticText;
//# sourceMappingURL=ConfigStaticText.js.map