import React from 'react';
import { TextField } from '@mui/material';
import ConfigGeneric from './ConfigGeneric';
function convertID2Topic(id, namespace) {
    let topic;
    if (namespace && id.substring(0, namespace.length) === namespace) {
        topic = id.substring(namespace.length + 1);
    }
    else {
        topic = id;
    }
    topic = topic.replace(/\./g, '/').replace(/_/g, ' ');
    return topic;
}
class ConfigTopic extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        if (!value && this.props.customObj?._id) {
            const topic = convertID2Topic(this.props.customObj._id, `${this.props.oContext.adapterName}.${this.props.oContext.instance}`);
            this.setState({ value: topic });
        }
        else {
            this.setState({ value: value || '' });
        }
    }
    renderItem(error, disabled /* , defaultValue */) {
        return (React.createElement(TextField, { variant: "standard", fullWidth: true, slotProps: {
                htmlInput: {
                    maxLength: this.props.schema.maxLength || this.props.schema.max || undefined,
                },
            }, value: this.state.value, error: !!error, disabled: disabled, placeholder: this.getText(this.props.schema.placeholder), label: this.getText(this.props.schema.label), helperText: this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation), onChange: e => {
                const value = e.target.value;
                this.setState({ value }, () => this.onChange(this.props.attr, value));
            } }));
    }
}
export default ConfigTopic;
//# sourceMappingURL=ConfigTopic.js.map