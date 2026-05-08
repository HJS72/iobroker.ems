import React from 'react';
import { InputLabel, TextField, MenuItem, FormHelperText, FormControl, Select } from '@mui/material';
import { Icon, Utils, I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
const styles = {
    icon: {
        width: 16,
        height: 16,
        marginRight: 8,
    },
};
class ConfigUser extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();
        this.props.oContext.socket
            .getUsers()
            .then(users => {
            const _users = {};
            const lang = I18n.getLanguage();
            if (this.props.schema.short) {
                users.forEach(user => (_users[user._id] = {
                    color: user.common?.color,
                    icon: user.common?.icon,
                    name: Utils.getObjectNameFromObj(user, lang),
                }));
            }
            else {
                users.forEach(user => (_users[user._id.replace(/^system\.user\./, '')] = {
                    color: user.common?.color,
                    icon: user.common?.icon,
                    name: Utils.getObjectNameFromObj(user, lang),
                }));
            }
            this.setState({ users: _users });
        })
            .catch(e => console.error(`Cannot get users: ${e}`));
    }
    renderItem(error, disabled /* , defaultValue */) {
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        return (React.createElement(FormControl, { variant: "standard", fullWidth: true },
            this.state.users && this.props.schema.label ? (React.createElement(InputLabel, null, this.getText(this.props.schema.label))) : null,
            !this.state.users ? (React.createElement(TextField, { variant: "standard", error: !!error, disabled: !!disabled, value: value, onChange: e => this.onChange(this.props.attr, e.target.value), label: this.getText(this.props.schema.label) })) : (React.createElement(Select, { variant: "standard", error: !!error, disabled: !!disabled, value: value, renderValue: val => (React.createElement("span", null,
                    this.state.users && this.state.users[val]?.icon ? (React.createElement(Icon, { src: this.state.users && this.state.users[val]?.icon, style: styles.icon })) : null,
                    (this.state.users && this.state.users[val]?.name) || val || '')), style: {
                    color: (this.state.users && this.state.users[value]?.color) || undefined,
                    backgroundColor: Utils.getInvertedColor(this.state.users && this.state.users[value]?.color, this.props.oContext.themeType),
                }, onChange: e => this.onChange(this.props.attr, e.target.value) }, this.state.users &&
                Object.keys(this.state.users).map(id => (React.createElement(MenuItem, { style: {
                        color: this.state.users[id].color || undefined,
                        backgroundColor: Utils.getInvertedColor(this.state.users[id].color, this.props.oContext.themeType),
                    }, key: id, value: id },
                    this.state.users[id].icon ? (React.createElement(Icon, { src: this.state.users[id].icon, style: styles.icon })) : null,
                    this.state.users[id].name))))),
            this.props.schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigUser;
//# sourceMappingURL=ConfigUser.js.map