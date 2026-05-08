import React from 'react';
import ConfigGeneric from './ConfigGeneric';
class ConfigImageSendTo extends ConfigGeneric {
    initialized = false;
    localContext;
    componentDidMount() {
        super.componentDidMount();
        this.askInstance();
    }
    askInstance() {
        if (this.props.alive) {
            let data = this.props.schema.data;
            if (data === undefined && this.props.schema.jsonData) {
                const dataStr = this.getPattern(this.props.schema.jsonData, null, true);
                if (dataStr) {
                    try {
                        data = JSON.parse(dataStr);
                    }
                    catch {
                        console.error(`Cannot parse json data: ${JSON.stringify(data)}`);
                    }
                }
            }
            if (data === undefined) {
                data = null;
            }
            void this.props.oContext.socket
                .sendTo(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, this.props.schema.command || 'send', data)
                .then(image => this.setState({ image: image || '' }));
        }
    }
    getContext() {
        const localContext = {};
        if (Array.isArray(this.props.schema.alsoDependsOn)) {
            this.props.schema.alsoDependsOn.forEach(attr => (localContext[attr] = ConfigGeneric.getValue(this.props.data, attr)));
        }
        return JSON.stringify(localContext);
    }
    renderItem( /* error, disabled, defaultValue */) {
        if (this.props.alive) {
            const localContext = this.getContext();
            if (localContext !== this.localContext || !this.initialized) {
                this.localContext = localContext;
                setTimeout(() => this.askInstance(), this.initialized ? 300 : 50);
                this.initialized = true;
            }
        }
        if (this.state.image === undefined) {
            return null;
        }
        return (React.createElement("img", { alt: "dynamic content", src: this.state.image, style: { width: this.props.schema.width || '100%', height: this.props.schema.height } }));
    }
}
export default ConfigImageSendTo;
//# sourceMappingURL=ConfigImageSendTo.js.map