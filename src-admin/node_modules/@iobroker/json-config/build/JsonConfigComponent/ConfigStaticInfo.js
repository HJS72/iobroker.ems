import React from 'react';
import { Box, Checkbox } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { I18n, Icon, Utils } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
function valueBlinkOnce(theme, force, color) {
    if (typeof color === 'string') {
        return {
            '@keyframes newValueAnimationOnceColor': {
                '0%': {
                    color: force ? `${color} !important` : color,
                },
                '100%': {
                    color: theme.palette.mode === 'dark'
                        ? force
                            ? '#fff !important'
                            : '#fff'
                        : force
                            ? '#000 !important'
                            : '#000',
                },
            },
            animation: 'newValueAnimationOnceColor 2s ease-in-out',
        };
    }
    return {
        '@keyframes newValueAnimationOnce': {
            '0%': {
                color: force ? `#00f900 !important` : '#00f900',
            },
            '80%': {
                color: theme.palette.mode === 'dark'
                    ? force
                        ? `#518851 !important`
                        : '#518851'
                    : force
                        ? `#008000 !important`
                        : '#008000',
            },
            '100%': {
                color: theme.palette.mode === 'dark'
                    ? force
                        ? '#fff !important'
                        : '#fff'
                    : force
                        ? '#000 !important'
                        : '#000',
            },
        },
        animation: 'newValueAnimationOnce 2s ease-in-out',
    };
}
function valueBlink(theme, color) {
    if (typeof color === 'string') {
        return {
            '@keyframes blinkAnimationColor': {
                '0%': {
                    color,
                },
                '100%': {
                    color: theme.palette.mode === 'dark' ? '#fff' : '#000',
                },
            },
            animation: 'blinkAnimationColor 2s ease-in-out infinite',
        };
    }
    return {
        '@keyframes blinkAnimation': {
            '0%': {
                color: '#00f900',
            },
            '80%': {
                color: theme.palette.mode === 'dark' ? '#518851' : '#008000',
            },
            '100%': {
                color: theme.palette.mode === 'dark' ? '#fff' : '#000',
            },
        },
        animation: 'blinkAnimation 2s ease-in-out infinite',
    };
}
const styles = {
    label: {
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
    },
    valueImage: {
        maxHeight: '100%',
    },
    valueAndUnit: {
        display: 'flex',
        gap: 4,
        alignItems: 'baseline',
    },
    value: {},
    unit: {
        fontSize: 'smaller',
        opacity: 0.7,
    },
};
class ConfigStaticInfo extends ConfigGeneric {
    renderItem(_error) {
        let label = this.getText(this.props.schema.text || this.props.schema.label, this.props.schema.noTranslation);
        if (this.props.schema.addColon && typeof label === 'string' && !label.trim().endsWith(':')) {
            label = `${label.trim()}:`;
        }
        if (label &&
            (label.includes('<a ') || label.includes('<br') || label.includes('<b>') || label.includes('<i>'))) {
            label = Utils.renderTextWithA(label);
        }
        let fontSize;
        if (this.props.schema.size === 'normal') {
            fontSize = 16;
        }
        else if (this.props.schema.size === 'large') {
            fontSize = 20;
        }
        else if (typeof this.props.schema.size === 'number') {
            fontSize = this.props.schema.size;
        }
        const divStyle = {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            fontSize,
        };
        if (this.props.schema.narrow) {
            divStyle.gap = 8;
        }
        else {
            divStyle.justifyContent = 'space-between';
        }
        let value;
        let valueTxt;
        if (this.props.schema.data && typeof this.props.schema.data === 'object' && this.props.schema.data.en) {
            valueTxt = this.getText(this.props.schema.data);
        }
        else if (typeof this.props.schema.data === 'object' ||
            this.props.schema.data === undefined ||
            this.props.schema.data === null) {
            valueTxt = JSON.stringify(this.props.schema.data);
        }
        else if (typeof this.props.schema.data === 'number') {
            valueTxt = this.props.schema.data.toString();
            if (this.props.oContext.isFloatComma) {
                valueTxt = valueTxt.replace('.', ',');
            }
        }
        else if (!this.props.schema.booleanAsCheckbox || typeof this.props.schema.data !== 'boolean') {
            valueTxt = this.props.schema.data.toString();
        }
        let multiLine = false;
        if (this.props.schema.booleanAsCheckbox && typeof this.props.schema.data === 'boolean') {
            value = (React.createElement(Checkbox, { checked: !!value, disabled: true, size: this.props.schema.size === 'small'
                    ? 'small'
                    : this.props.schema.size === 'large'
                        ? 'large'
                        : undefined }));
        }
        else if (valueTxt.startsWith('data:image/')) {
            value = (React.createElement("div", { style: { ...styles.value, ...styles.valueImage, ...(this.props.schema.styleValue || undefined) } },
                React.createElement(Icon, { src: valueTxt })));
        }
        else {
            const valStyle = { ...styles.value, ...(this.props.schema.styleValue || undefined) };
            if (this.props.schema.html) {
                value = (React.createElement("div", { style: valStyle, dangerouslySetInnerHTML: { __html: valueTxt } }));
            }
            else {
                if (Array.isArray(this.props.schema.data)) {
                    multiLine = true;
                    value = (React.createElement("div", { style: valStyle }, this.props.schema.data.map((it, i) => (React.createElement("div", { key: i }, typeof it === 'object' || it === null || it === undefined
                        ? JSON.stringify(it)
                        : it)))));
                }
                else {
                    if (valueTxt.includes('\n')) {
                        multiLine = true;
                        value = React.createElement("div", { style: valStyle }, Utils.renderTextWithA(valueTxt));
                    }
                    else {
                        value = React.createElement("div", { style: valStyle }, valueTxt);
                    }
                }
            }
        }
        if (this.props.schema.blinkOnUpdate && this.props.schema.blink) {
            const style1 = valueBlinkOnce(this.props.oContext.theme, true, this.props.schema.blinkOnUpdate);
            const style2 = valueBlink(this.props.oContext.theme, this.props.schema.blink);
            value = (React.createElement(Box, { key: valueTxt, sx: { ...style1, ...style2 } }, value));
        }
        else if (this.props.schema.blinkOnUpdate) {
            const style = valueBlinkOnce(this.props.oContext.theme, false, this.props.schema.blinkOnUpdate);
            value = (React.createElement(Box, { key: valueTxt, sx: style }, value));
        }
        else if (this.props.schema.blink) {
            const style = valueBlink(this.props.oContext.theme, this.props.schema.blink);
            value = React.createElement(Box, { sx: style }, value);
        }
        if (this.props.schema.unit) {
            value = (React.createElement("div", { style: styles.valueAndUnit },
                value,
                React.createElement("div", { style: { ...styles.unit, ...(this.props.schema.styleUnit || undefined) } }, this.getText(this.props.schema.unit, this.props.schema.noTranslation))));
        }
        let labelIcon;
        if (this.props.schema.labelIcon) {
            labelIcon = (React.createElement(Icon, { src: this.props.schema.labelIcon, style: { marginRight: 4 } }));
        }
        let copyButton;
        if (this.props.schema.copyToClipboard) {
            copyButton = (React.createElement(ContentCopy, { className: "staticCopyButton", style: {
                    position: 'absolute',
                    top: 'calc(50% - 12px)',
                    right: 0,
                    cursor: 'pointer',
                }, onClick: () => {
                    Utils.copyToClipboard(valueTxt);
                    window.alert(I18n.t('ra_Copied'));
                } }));
        }
        const boxStyle = {
            '& .staticCopyButton': {
                display: 'none',
            },
            '& .staticCopyButton:action': {
                transform: 'scale(0.9)',
            },
            '&:hover .staticCopyButton': {
                display: 'block',
            },
        };
        if (this.props.schema.highlight) {
            boxStyle['&:hover'] = {
                backgroundColor: this.props.oContext.themeType === 'dark' ? '#51515180' : '#b8b8b880',
            };
        }
        if (multiLine) {
            divStyle.alignItems = 'top';
        }
        return (React.createElement(Box, { component: "div", style: divStyle, sx: boxStyle },
            React.createElement("div", { style: { ...styles.label, ...(this.props.schema.styleLabel || undefined) } },
                labelIcon,
                label),
            value,
            copyButton));
    }
}
export default ConfigStaticInfo;
//# sourceMappingURL=ConfigStaticInfo.js.map