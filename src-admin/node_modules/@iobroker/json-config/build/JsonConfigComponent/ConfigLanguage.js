import React from 'react';
import { InputLabel, MenuItem, FormHelperText, FormControl, Select } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
const LANGUAGES = [
    {
        value: 'en',
        label: 'English',
    },
    {
        value: 'de',
        label: 'Deutsch',
    },
    {
        value: 'ru',
        label: 'русский',
    },
    {
        value: 'pt',
        label: 'Portugues',
    },
    {
        value: 'nl',
        label: 'Nederlands',
    },
    {
        value: 'fr',
        label: 'français',
    },
    {
        value: 'it',
        label: 'Italiano',
    },
    {
        value: 'es',
        label: 'Espanol',
    },
    {
        value: 'pl',
        label: 'Polski',
    },
    {
        value: 'uk',
        label: 'Український',
    },
    {
        value: 'zh-cn',
        label: '简体中文',
    },
];
class ConfigLanguage extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        const languages = [...LANGUAGES];
        if (this.props.schema.system) {
            languages.unshift({ value: '', label: I18n.t('ra_System language') });
        }
        else {
            languages.unshift({ value: '', label: I18n.t('ra_none') });
        }
        this.setState({
            value: this.props.schema.system ? value || '' : value || I18n.getLanguage(),
            selectOptions: languages,
        });
    }
    renderItem(error, disabled) {
        if (!this.state.selectOptions) {
            return null;
        }
        const item = this.state.selectOptions?.find(it => it.value === this.state.value || (!it.value && !this.state.value));
        return (React.createElement(FormControl, { fullWidth: true, variant: "standard" },
            this.props.schema.label ? React.createElement(InputLabel, null, this.getText(this.props.schema.label)) : null,
            React.createElement(Select, { variant: "standard", error: !!error, disabled: disabled, value: this.state.value || '_', renderValue: () => this.getText(item?.label, this.props.schema.noTranslation), onChange: e => {
                    let { value } = e.target;
                    if (value === '_') {
                        value = '';
                    }
                    this.setState({ value }, () => {
                        const mayBePromise = this.onChange(this.props.attr, value);
                        if (mayBePromise instanceof Promise) {
                            void mayBePromise.catch(err => console.error(err));
                        }
                        if (this.props.schema.changeGuiLanguage) {
                            if (value) {
                                if (value === I18n.getLanguage()) {
                                    return;
                                }
                                I18n.setLanguage(value);
                                if (this.props.oContext.changeLanguage) {
                                    this.props.oContext.changeLanguage();
                                }
                            }
                            else {
                                void this.props.oContext.socket
                                    .getSystemConfig()
                                    .then((systemConfig) => {
                                    if (systemConfig.common.language === I18n.getLanguage()) {
                                        return;
                                    }
                                    if (systemConfig.common.language) {
                                        I18n.setLanguage(systemConfig.common.language);
                                        if (this.props.oContext.changeLanguage) {
                                            this.props.oContext.changeLanguage();
                                        }
                                    }
                                })
                                    .catch(e => console.error(`Cannot read system config: ${e}`));
                            }
                        }
                    });
                } }, this.state.selectOptions?.map(it => (React.createElement(MenuItem, { key: it.value, value: it.value }, it.label)))),
            this.props.schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigLanguage;
//# sourceMappingURL=ConfigLanguage.js.map