import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, FormControlLabel, Checkbox, } from '@mui/material';
import { Check, Close } from '@mui/icons-material';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
class ConfigLicense extends ConfigGeneric {
    scrollRef;
    constructor(props) {
        super(props);
        this.scrollRef = React.createRef();
    }
    scrolledDown() {
        if (!this.scrollRef.current) {
            return false;
        }
        return (this.scrollRef.current.offsetHeight + this.scrollRef.current.scrollTop >=
            this.scrollRef.current.scrollHeight);
    }
    componentDidMount() {
        super.componentDidMount();
        if (!ConfigGeneric.getValue(this.props.data, this.props.attr)) {
            if (this.props.schema.licenseUrl) {
                this.setState({ showLicenseDialog: true, loading: true, scrolledDown: false });
                fetch(this.props.schema.licenseUrl)
                    .then(res => res.text())
                    .then(text => this.setState({ license: text, loading: false }))
                    .catch(e => this.setState({
                    license: e.toString(),
                    loading: false,
                    error: true,
                    scrolledDown: false,
                }));
            }
            else {
                this.setState({ showLicenseDialog: true, scrolledDown: false });
            }
            setTimeout(() => {
                // install scroll handler
                if (this.scrollRef.current) {
                    const scrolledDown = this.scrolledDown();
                    if (!scrolledDown) {
                        this.scrollRef.current.addEventListener('scroll', () => {
                            if (!this.state.scrolledDown && this.scrolledDown()) {
                                this.setState({ scrolledDown: true });
                            }
                        });
                    }
                    else {
                        this.setState({ scrolledDown: true });
                    }
                }
            }, 1000);
        }
    }
    renderItem(_error, disabled /*, defaultValue */) {
        if (!this.state.showLicenseDialog) {
            return null;
        }
        return (React.createElement(Dialog, { maxWidth: "lg", open: !0, onClose: (e, reason) => {
                if (reason !== 'escapeKeyDown' && reason !== 'backdropClick') {
                    this.setState({ showLicenseDialog: false });
                }
            } },
            React.createElement(DialogTitle, null, this.props.schema.title ? I18n.t(this.props.schema.title) : I18n.t('ra_License agreement')),
            React.createElement(DialogContent, null,
                this.props.schema.licenseUrl ? (React.createElement(React.Fragment, null,
                    this.state.loading ? React.createElement(LinearProgress, null) : null,
                    React.createElement("pre", { ref: this.scrollRef, style: {
                            width: '100%',
                            height: '100%',
                            overflowY: 'auto',
                            fontSize: 14,
                        } }, this.state.license))) : null,
                !this.props.schema.licenseUrl && this.props.schema.texts ? (React.createElement("div", { ref: this.scrollRef, style: {
                        width: '100%',
                        height: '100%',
                        overflowY: 'auto',
                        fontSize: 14,
                    } }, this.props.schema.texts.map((text, i) => this.props.schema.noTranslation ? React.createElement("p", { key: i }, text) : React.createElement("p", { key: i }, I18n.t(text))))) : null),
            React.createElement(DialogActions, null,
                this.props.schema.checkBox ? (React.createElement(FormControlLabel, { control: React.createElement(Checkbox, { disabled: disabled, checked: !!this.state.licenseChecked, onClick: () => this.setState({ licenseChecked: !this.state.licenseChecked }) }), label: I18n.t(this.props.schema.checkBox) })) : null,
                React.createElement(Button, { disabled: disabled ||
                        this.state.loading ||
                        this.state.error ||
                        (this.props.schema.checkBox && !this.state.licenseChecked) ||
                        !this.state.scrolledDown, onClick: () => {
                        this.setState({ showLicenseDialog: false });
                        const mayBePromise = this.onChange(this.props.attr, true);
                        if (mayBePromise instanceof Promise) {
                            mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                        }
                    }, color: "primary", variant: "contained", startIcon: React.createElement(Check, null) }, this.props.schema.agreeText
                    ? I18n.t(this.props.schema.agreeText)
                    : I18n.t('ra_Accept license')),
                React.createElement(Button, { onClick: () => {
                        this.setState({ showLicenseDialog: false });
                        setTimeout(() => this.setState({ showLicenseDialog: true }), 2000);
                    }, color: "grey", variant: "contained", startIcon: React.createElement(Close, null) }, I18n.t('ra_Close')))));
    }
}
export default ConfigLicense;
//# sourceMappingURL=ConfigLicense.js.map