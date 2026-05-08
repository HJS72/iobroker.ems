import { type JSX } from 'react';
import type { ConfigItemSelect } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigInstanceSelectProps extends ConfigGenericProps {
    schema: ConfigItemSelect;
}
interface ConfigInstanceSelectState extends ConfigGenericState {
    selectOptions?: {
        label: string;
        value: number | string;
        group?: boolean;
        hidden?: string | boolean;
        color?: string;
    }[];
}
declare class ConfigSelect extends ConfigGeneric<ConfigInstanceSelectProps, ConfigInstanceSelectState> {
    private initialValue;
    componentDidMount(): void;
    _getValue(): string | string[];
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigSelect;
