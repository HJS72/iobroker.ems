import { type JSX } from 'react';
import type { ConfigItemLanguage } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface LanguageSelectOption {
    /** Value to save */
    value: string;
    /** Label to show */
    label: string;
}
interface ConfigLanguageProps extends ConfigGenericProps {
    schema: ConfigItemLanguage;
}
interface ConfigLanguageState extends ConfigGenericState {
    selectOptions: LanguageSelectOption[];
}
declare class ConfigLanguage extends ConfigGeneric<ConfigLanguageProps, ConfigLanguageState> {
    componentDidMount(): void;
    renderItem(error: unknown, disabled: boolean): JSX.Element | null;
}
export default ConfigLanguage;
