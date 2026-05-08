import React from 'react';
import { LinearProgress } from '@mui/material';
import { registerRemotes, loadRemote, init } from '@module-federation/runtime';
import * as IconsMaterial from '@mui/icons-material';
import * as AdapterReact from '@iobroker/adapter-react-v5';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
import * as JsonConfig from '../';
init({
    name: 'iobroker_admin',
    shared: {
        '@iobroker/adapter-react-v5': {
            lib: () => AdapterReact,
            version: '*',
        },
        '@mui/icons-material': {
            lib: () => IconsMaterial,
            version: '*',
        },
        '@iobroker/json-config': {
            lib: () => JsonConfig,
            version: '*',
        },
    },
    remotes: [],
});
export default class ConfigCustom extends ConfigGeneric {
    static runningLoads = {};
    constructor(props) {
        super(props);
        // schema.url - location of Widget
        // schema.name - Component name
        // schema.i18n - i18n
        Object.assign(this.state, {
            Component: null,
            error: '',
        });
    }
    // load component dynamically
    async componentDidMount() {
        if (!this.props.schema.url) {
            console.error('URL is empty. Cannot load custom component!');
            this.setState({ error: 'URL is empty. Cannot load custom component!' });
            return;
        }
        let url;
        if (this.props.schema.url.startsWith('http:') || this.props.schema.url.startsWith('https:')) {
            url = this.props.schema.url;
        }
        else if (this.props.schema.url.startsWith('./')) {
            url = `${window.location.protocol}//${window.location.host}${this.props.schema.url.replace(/^\./, '')}`;
        }
        else {
            url = `${window.location.protocol}//${window.location.host}/adapter/${this.props.oContext.adapterName}/${this.props.schema.url}`;
        }
        const [uniqueName, fileToLoad, ...componentNameParts] = this.props.schema.name.split('/');
        const componentName = componentNameParts.join('/');
        if (!url) {
            console.error('Cannot find URL for custom component! Please define "url" as "custom/customComponents.js" in the schema');
            return;
        }
        if (!uniqueName || !fileToLoad || !componentName) {
            console.error('Invalid format of "name"! Please define "name" as "ConfigCustomBackItUpSet/Components/AdapterExist" in the schema');
            return;
        }
        let setPromise = ConfigCustom.runningLoads[`${url}!${fileToLoad}`];
        if (!(setPromise instanceof Promise)) {
            let i18nPromise;
            if (this.props.schema.i18n === true) {
                // load i18n from files
                const pos = url.lastIndexOf('/');
                let i18nURL;
                if (pos !== -1) {
                    i18nURL = url.substring(0, pos);
                }
                else {
                    i18nURL = url;
                }
                const lang = I18n.getLanguage();
                const file = `${i18nURL}/i18n/${lang}.json`;
                i18nPromise = fetch(file)
                    .then(data => data.json())
                    .then(json => I18n.extendTranslations(json, lang))
                    .catch(error => {
                    if (lang !== 'en') {
                        // try to load English
                        fetch(`${i18nURL}/i18n/en.json`)
                            .then(data => data.json())
                            .then(json => I18n.extendTranslations(json, lang))
                            .catch(err => console.log(`Cannot load i18n "${file}": ${err}`));
                        return;
                    }
                    console.log(`Cannot load i18n "${file}": ${error}`);
                });
            }
            else if (this.props.schema.i18n && typeof this.props.schema.i18n === 'object') {
                try {
                    I18n.extendTranslations(this.props.schema.i18n);
                }
                catch (error) {
                    console.error(`Cannot import i18n: ${error}`);
                }
            }
            try {
                console.log(url, uniqueName, fileToLoad, componentName);
                registerRemotes([
                    {
                        name: uniqueName,
                        entry: url,
                        type: this.props.schema.bundlerType || undefined,
                    },
                ]);
                setPromise = loadRemote(`${uniqueName}/${fileToLoad}`);
                if (i18nPromise instanceof Promise) {
                    setPromise = Promise.all([setPromise, i18nPromise]).then(result => result[0]);
                }
                // remember promise
                ConfigCustom.runningLoads[`${url}!${fileToLoad}`] = setPromise;
            }
            catch (error) {
                console.error(error);
                this.setState({ error: `Cannot import from ${this.props.schema.url}: ${error}` });
            }
        }
        try {
            const component = (await setPromise).default;
            if (!component?.[componentName]) {
                const keys = Object.keys(component || {});
                console.error('URL is empty. Cannot load custom component!');
                this.setState({
                    error: `Component ${this.props.schema.name} not found in ${this.props.schema.url}. Found: ${keys.join(', ')}`,
                });
            }
            else {
                this.setState({ Component: component[componentName] });
            }
        }
        catch (error) {
            console.error(error);
            this.setState({ error: `Cannot import from ${this.props.schema.url}: ${error}` });
        }
    }
    render() {
        const CustomComponent = this.state.Component;
        const schema = this.props.schema || {};
        const item = CustomComponent ? (React.createElement(CustomComponent, { ...this.props, 
            // @ts-expect-error BF (2024-12-18) Remove after the 7.4 will be mainstream. All following lines
            socket: this.props.oContext.socket, theme: this.props.oContext.theme, themeType: this.props.oContext.themeType, instance: this.props.oContext.instance, adapterName: this.props.oContext.adapterName, systemConfig: this.props.oContext.systemConfig, forceUpdate: this.props.oContext.forceUpdate })) : this.state.error ? (React.createElement("div", null, this.state.error)) : (React.createElement(LinearProgress, null));
        if (schema.newLine) {
            return (React.createElement(React.Fragment, null,
                React.createElement("div", { style: { flexBasis: '100%', height: 0 } }),
                item));
        }
        return item;
    }
}
//# sourceMappingURL=ConfigCustom.js.map