import React from 'react';
import { Button, TextField } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
export default class ConfigOAuth2 extends ConfigGeneric {
    authWindow;
    oid;
    url;
    constructor(props) {
        super(props);
        this.state = {
            ...this.state,
            accessTokens: '',
            success: false,
            blocked: false,
            running: false,
            pressed: false,
        };
        this.url = `https://oauth2.iobroker.in/${props.schema.identifier}?redirect=true`;
        if (props.schema.scope) {
            this.url += `&scope=${encodeURIComponent(props.schema.scope)}`;
        }
        this.oid = `${this.props.oContext.adapterName}.${this.props.oContext.instance}.${this.props.schema.saveTokenIn || 'oauth2Tokens'}`;
    }
    async componentDidMount() {
        super.componentDidMount();
        if (window.addEventListener) {
            window.addEventListener('message', this.onMessage, false);
        }
        else {
            window.attachEvent('onmessage', this.onMessage, false);
        }
        await this.props.oContext.socket.subscribeState(this.oid, this.onTokensUpdated);
        // read tokens
        const tokens = await this.props.oContext.socket.getState(this.oid);
        if (tokens) {
            const accessTokens = JSON.parse(tokens.val);
            if (new Date(accessTokens.access_token_expires_on).getTime() > Date.now()) {
                this.setState({ accessTokens: tokens.val });
            }
        }
    }
    onTokensUpdated = (_id, state) => {
        if (state?.val) {
            const accessTokens = JSON.parse(state.val);
            if (new Date(accessTokens.access_token_expires_on).getTime() > Date.now()) {
                if (this.state.accessTokens !== state.val) {
                    this.setState({ accessTokens: state.val });
                }
                return;
            }
        }
        this.setState({ accessTokens: '' });
    };
    componentWillUnmount() {
        super.componentWillUnmount();
        if (window.removeEventListener) {
            window.removeEventListener('message', this.onMessage, false);
        }
        else {
            window.detachEvent('onmessage', this.onMessage, false);
        }
        this.props.oContext.socket.unsubscribeState(this.oid, this.onTokensUpdated);
    }
    saveToken(accessTokens) {
        try {
            if (accessTokens && !accessTokens.startsWith('{')) {
                // convert base64 to string
                accessTokens = atob(accessTokens);
            }
            const accessTokensParsed = JSON.parse(accessTokens);
            if (accessTokensParsed.access_token && accessTokensParsed.refresh_token && accessTokensParsed.expires_in) {
                // Give 10 seconds to user to copy the token
                accessTokensParsed.access_token_expires_on ||= new Date(Date.now() + accessTokensParsed.expires_in * 1000).toISOString();
                this.props.oContext.socket
                    .setState(this.oid, JSON.stringify(accessTokensParsed), true)
                    .catch((e) => console.log(`Error occurred: ${e.toString()}`));
            }
        }
        catch (e) {
            // ignore
            console.warn(e);
        }
    }
    onMessage = (event) => {
        if (event.origin !== 'https://oauth2.iobroker.in') {
            return;
        }
        if ((typeof event.data === 'string' &&
            event.data.startsWith(`${this.props.schema.identifier}-authentication:`)) ||
            (typeof event.message === 'string' &&
                event.message.startsWith(`${this.props.schema.identifier}-authentication:`))) {
            const parts = (event.data || event.message).split(':');
            if (parts[1] === 'success') {
                this.setState({ accessTokens: parts[2], success: true, pressed: false }, () => this.saveToken(this.state.accessTokens));
                // send message to auth window to close it
                this.authWindow?.postMessage('close', event.origin);
                this.authWindow = null;
            }
            else {
                this.props.onError?.(parts[2]);
            }
        }
    };
    onOpenUrl() {
        this.authWindow = window.open(this.url, this.props.schema.identifier);
        if (!this.authWindow || this.authWindow.closed || typeof this.authWindow.closed === 'undefined') {
            this.setState({ blocked: true });
        }
        else {
            this.setState({ pressed: true });
        }
    }
    renderItem() {
        let validTill = '';
        if (this.state.accessTokens) {
            try {
                const accessTokensParsed = JSON.parse(this.state.accessTokens);
                validTill = new Date(accessTokensParsed.access_token_expires_on).toLocaleString();
            }
            catch {
                // ignore
            }
        }
        let label;
        if (this.state.accessTokens) {
            label = this.props.schema.refreshLabel
                ? this.getText(this.props.schema.refreshLabel)
                : I18n.t('ra_Renew %s access', this.props.schema.identifier[0].toUpperCase() + this.props.schema.identifier.slice(1));
        }
        else {
            label = this.props.schema.label
                ? this.getText(this.props.schema.label)
                : I18n.t('ra_Get %s access', this.props.schema.identifier[0].toUpperCase() + this.props.schema.identifier.slice(1));
        }
        const icon = this.getIcon();
        return (React.createElement("div", { style: { width: '100%', margin: '0 0 1rem 0' } },
            React.createElement(Button, { disabled: this.state.running, endIcon: icon || React.createElement(CloudUpload, null), variant: "contained", onClick: () => this.onOpenUrl() }, label),
            this.state.blocked ? (React.createElement("div", { style: { color: 'red', fontSize: 16, marginTop: 20 } }, I18n.t('ra_Please allow popups in your browser for this page!'))) : null,
            this.state.accessTokens ? (React.createElement("div", { style: { color: 'green', fontSize: 16, marginTop: 20 } }, this.props.alive
                ? I18n.t('ra_Successfully authorized. Token valid till %s and will be automatically renewed.', validTill)
                : I18n.t('ra_Successfully authorized. Token valid till %s but it can expire as the instance is not running.', validTill))) : null,
            this.state.pressed ? (React.createElement(React.Fragment, null,
                React.createElement("div", { style: { width: '100%', margin: '1rem 0 1rem 0' } },
                    React.createElement("span", { style: { marginRight: 4 } },
                        `${I18n.t('ra_If the button above does not work, you can authorize manually this app by visiting this url')}`,
                        ":"),
                    React.createElement("br", null),
                    React.createElement("a", { target: this.props.schema.identifier, href: this.url, rel: "noreferrer" }, this.url)),
                React.createElement(TextField, { value: this.state.accessTokens, label: I18n.t('ra_Enter the code from that page here'), variant: "standard", onChange: e => {
                        let accessTokens = e.target.value;
                        if (accessTokens && !accessTokens.startsWith('{')) {
                            // convert base64 to string
                            accessTokens = atob(accessTokens);
                        }
                        try {
                            const accessTokensParsed = JSON.parse(accessTokens);
                            if (accessTokensParsed.access_token) {
                                accessTokensParsed.access_token_expires_on = new Date(Date.now() + (accessTokensParsed.expires_in - 10) * 1000).toISOString();
                                this.setState({ accessTokens: JSON.stringify(accessTokensParsed) }, () => this.saveToken(this.state.accessTokens));
                            }
                        }
                        catch {
                            // ignore
                        }
                    }, fullWidth: true }))) : null));
    }
}
//# sourceMappingURL=ConfigOAuth2.js.map