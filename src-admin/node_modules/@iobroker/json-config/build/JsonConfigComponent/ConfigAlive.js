import React from 'react';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
const styles = {
    root: {
        width: '100%',
    },
    notAlive: {
        color: '#a30000',
    },
};
class ConfigAlive extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();
        const instance = this.getInstance();
        void this.props.oContext.socket
            .getState(`${instance}.alive`)
            .then(state => this.setState({ alive: !!(state && state.val), instance }));
    }
    getInstance() {
        let instance = this.props.schema.instance || `${this.props.oContext.adapterName}.${this.props.oContext.instance}`;
        if (instance.includes('${')) {
            instance = this.getPattern(instance, null, true);
        }
        if (instance && !instance.startsWith('system.adapter.')) {
            instance = `system.adapter.${instance}`;
        }
        return instance;
    }
    renderItem() {
        if (this.getInstance() !== this.state.instance) {
            setTimeout(() => {
                const instance = this.getInstance();
                if (instance) {
                    void this.props.oContext.socket
                        .getState(`${instance}.alive`)
                        .then(state => this.setState({ alive: !!(state && state.val), instance }));
                }
                else {
                    this.setState({ alive: null, instance });
                }
            }, 200);
        }
        if (this.state.alive !== false && this.state.alive !== true) {
            return null;
        }
        const instance = this.state.instance.replace(/^system.adapter./, '');
        return (React.createElement("div", { style: { ...styles.root, ...(!this.state.alive ? styles.notAlive : undefined) } }, this.state.alive
            ? this.props.schema.textAlive !== undefined
                ? this.props.schema.textAlive
                    ? I18n.t(this.props.schema.textAlive, instance)
                    : ''
                : I18n.t('ra_Instance %s is alive', instance)
            : this.props.schema.textNotAlive !== undefined
                ? this.props.schema.textNotAlive
                    ? I18n.t(this.props.schema.textNotAlive, instance)
                    : ''
                : I18n.t('ra_Instance %s is not alive', instance)));
    }
}
export default ConfigAlive;
//# sourceMappingURL=ConfigAlive.js.map