import React from 'react';
import { InputLabel, MenuItem, FormControl, Select, FormHelperText } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
class ConfigCertCollection extends ConfigGeneric {
    async componentDidMount() {
        super.componentDidMount();
        let collectionsOptions;
        const collectionsOptionsObj = await this.props.oContext.socket.getObject('system.certificates');
        if (collectionsOptionsObj?.native?.collections) {
            collectionsOptions = Object.keys(collectionsOptionsObj.native.collections);
        }
        else {
            collectionsOptions = [];
        }
        this.setState({ collectionsOptions });
    }
    renderItem(error, disabled /* , defaultValue */) {
        if (!this.state.collectionsOptions) {
            return null;
        }
        const leCollection = (ConfigGeneric.getValue(this.props.data, this.props.schema.leCollectionName || 'leCollection') || 'false').toString();
        return (React.createElement(FormControl, { style: { width: '100%' }, variant: "standard" },
            this.props.schema.label ? (React.createElement(InputLabel, { shrink: true }, this.getText(this.props.schema.label))) : null,
            React.createElement(Select, { variant: "standard", error: !!error, displayEmpty: true, disabled: !!disabled, value: leCollection, onChange: e => this.onChange(this.props.schema.leCollectionName || 'leCollection', e.target.value === 'false' ? false : e.target.value === 'true' ? true : e.target.value) },
                React.createElement(MenuItem, { key: "_false", value: "false", style: { fontWeight: 'bold' } }, I18n.t("ra_Do not use let's encrypt")),
                React.createElement(MenuItem, { key: "_true", value: "true", style: { fontWeight: 'bold' } }, I18n.t("ra_Use all available let's encrypt certificates")),
                this.state.collectionsOptions?.map(item => (React.createElement(MenuItem, { key: item, value: item }, item)))),
            this.props.schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigCertCollection;
//# sourceMappingURL=ConfigCertCollection.js.map